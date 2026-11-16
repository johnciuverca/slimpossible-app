-- Scrub account-level scoring details when Auth deletes an account while
-- preserving finalized challenge awards and their aggregate winner counts.
begin;

create table public.account_erasure_context (
  user_id uuid primary key
);
alter table public.account_erasure_context enable row level security;
revoke all on public.account_erasure_context from public, anon, authenticated, service_role;

create function public._account_erasure_is_active(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.account_erasure_context as context
    where context.user_id = target_user_id
  )
$$;
revoke all on function public._account_erasure_is_active(uuid)
  from public, anon, authenticated, service_role;

alter table public.challenges
  alter column owner_id drop not null,
  alter column created_by drop not null,
  drop constraint challenges_owner_id_fkey,
  drop constraint challenges_created_by_fkey,
  add constraint challenges_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete set null,
  add constraint challenges_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

create or replace function public.prevent_challenge_ownership_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.created_by is distinct from old.created_by then
    if ((new.owner_id is not distinct from old.owner_id)
          or (new.owner_id is null and public._account_erasure_is_active(old.owner_id)))
       and ((new.created_by is not distinct from old.created_by)
          or (new.created_by is null and public._account_erasure_is_active(old.created_by))) then
      return new;
    end if;
    raise exception using errcode = '42501',
      message = 'Challenge ownership cannot be changed.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_participant_archived_challenges()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  affected_ids uuid[];
  affected_count integer;
  locked_count integer;
begin
  if tg_op = 'DELETE' and public._account_erasure_is_active(old.user_id) then
    return old;
  end if;
  if tg_op = 'INSERT' then
    affected_ids := array[new.challenge_id];
  elsif tg_op = 'DELETE' then
    if not exists (select 1 from public.challenges as challenge
      where challenge.id = old.challenge_id) then
      return old;
    end if;
    affected_ids := array[old.challenge_id];
  else
    affected_ids := array[old.challenge_id, new.challenge_id];
  end if;

  select count(distinct affected.challenge_id)::integer into affected_count
  from unnest(affected_ids) as affected(challenge_id);
  perform challenge.id from public.challenges as challenge
  where challenge.id = any(affected_ids)
  order by challenge.id for update of challenge;
  get diagnostics locked_count = row_count;

  if locked_count <> affected_count or exists (
    select 1 from public.challenges as challenge
    where challenge.id = any(affected_ids) and challenge.status = 'archived'
  ) then
    raise exception using errcode = '42501',
      message = 'Archived challenges cannot change group membership.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public._scrub_account_before_auth_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  scope record;
begin
  insert into public.account_erasure_context(user_id) values (old.id)
  on conflict (user_id) do nothing;

  -- Source row triggers run first; then reserve every affected award week in
  -- deterministic order so a concurrent lazy finalizer cannot recreate PII.
  delete from public.personal_weigh_ins as personal
  where personal.user_id = old.id;
  for scope in
    select scopes.challenge_id, scopes.sunday
    from (
      select week.challenge_id, week.sunday
      from public.group_weekly_candidate_weeks as week
      where week.challenge_id in (
        select participant.challenge_id from public.participants as participant
        where participant.user_id = old.id
      )
      union
      select winner.challenge_id, winner.sunday
      from public.group_weekly_result_winners as winner
      where winner.user_id = old.id
    ) as scopes
    order by public._group_weekly_lock_key(scopes.challenge_id, scopes.sunday)
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._group_weekly_lock_key(scope.challenge_id, scope.sunday)
    );
  end loop;

  -- Keep fixed challenge-level outcomes while removing the sole winner's name.
  update public.group_weekly_results as result
  set sole_participant_name = 'Deleted member'
  from public.group_weekly_candidates as candidate
  where candidate.user_id = old.id
    and candidate.challenge_id = result.challenge_id
    and candidate.sunday = result.sunday
    and result.eligible_participant_count = 1
    and result.sole_participant_name = candidate.display_name;

  -- Preserve one anonymous row for each winning award. The account identifiers,
  -- member key, name, weights and interpolation evidence are erased in place.
  update public.group_weekly_result_winners as winner
  set user_id = null,
      participant_id = null,
      member_key = null,
      display_name = 'Deleted member',
      weight_change_kg = null,
      previous_weight_kg = null,
      current_weight_kg = null,
      baseline_source = null,
      baseline_source_date = null,
      baseline_before_date = null,
      baseline_before_weight_kg = null,
      baseline_after_date = null,
      baseline_after_weight_kg = null
  where winner.user_id = old.id;

  -- Invitation digests are no longer usable or attributable to the deleted user.
  delete from public.challenge_invites as invite
  where invite.created_by = old.id;

  -- Challenges survive account erasure. A missing owner/creator is represented
  -- as NULL; active members retain access to their group history.
  update public.challenges as challenge
  set owner_id = case when challenge.owner_id = old.id then null else challenge.owner_id end,
      created_by = case when challenge.created_by = old.id then null else challenge.created_by end
  where challenge.owner_id = old.id or challenge.created_by = old.id;

  -- Participant deletion cascades legacy weigh-ins and target milestones,
  -- including for archived groups under the narrowly scoped context above.
  delete from public.participants as participant
  where participant.user_id = old.id;

  delete from public.group_weekly_candidates as candidate
  where candidate.user_id = old.id;

  delete from public.account_erasure_context as context
  where context.user_id = old.id;
  return old;
end;
$$;
revoke all on function public._scrub_account_before_auth_delete()
  from public, anon, authenticated, service_role;

create trigger auth_users_scrub_weekly_awards_before_delete
before delete on auth.users
for each row execute function public._scrub_account_before_auth_delete();

-- Account erasure can leave a challenge without its original owner. Keep the
-- existing owner-only delete rule, with a narrow fallback for an archived
-- ownerless group: an active remaining member may remove that group and its
-- challenge-scoped awards through the established cascade.
create or replace function public.delete_archived_group_challenge(target_challenge_id uuid)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  challenge_row public.challenges%rowtype;
  actor_owns boolean;
  actor_is_active_member boolean;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  select challenge.* into challenge_row
  from public.challenges as challenge
  where challenge.id = target_challenge_id
  for update;
  if not found or challenge_row.challenge_kind = 'personal' then
    raise exception using errcode = '42501', message = 'Archived group challenge ownership required.';
  end if;
  if challenge_row.status <> 'archived' then
    raise exception using errcode = '22023', message = 'Only archived group challenges can be permanently deleted.';
  end if;
  actor_owns := challenge_row.owner_id = actor_id;
  actor_is_active_member := challenge_row.owner_id is null and exists (
    select 1 from public.participants as participant
    where participant.challenge_id = challenge_row.id
      and participant.user_id = actor_id and participant.status = 'active'
  );
  if not actor_owns and not actor_is_active_member then
    raise exception using errcode = '42501', message = 'Archived group challenge ownership required.';
  end if;

  delete from public.challenges as challenge
  where challenge.id = target_challenge_id
    and challenge.owner_id is not distinct from challenge_row.owner_id
    and (challenge.owner_id = actor_id or (challenge.owner_id is null and exists (
      select 1 from public.participants as participant
      where participant.challenge_id = challenge.id
        and participant.user_id = actor_id and participant.status = 'active'
    )))
    and challenge.status = 'archived'
    and challenge.challenge_kind is distinct from 'personal';
  if not found then
    raise exception using errcode = '40001', message = 'Challenge state changed; refresh and try again.';
  end if;
  return true;
end;
$$;
revoke all on function public.delete_archived_group_challenge(uuid) from public, anon;
grant execute on function public.delete_archived_group_challenge(uuid) to authenticated;

commit;

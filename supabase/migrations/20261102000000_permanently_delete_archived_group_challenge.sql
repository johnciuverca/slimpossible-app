-- Issue #373: permanently delete an archived group challenge and its
-- challenge-owned records using the reviewed foreign-key cascades.
begin;

-- Archived-history guards normally block membership deletion. Let the
-- challenge's own FK cascade remove a participant only after its parent row is
-- gone; direct member deletion while the archived challenge exists stays
-- rejected.
create or replace function public.guard_participant_archived_challenges()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  affected_ids uuid[];
  affected_count integer;
  locked_count integer;
begin
  if tg_op = 'INSERT' then
    affected_ids := array[new.challenge_id];
  elsif tg_op = 'DELETE' then
    if not exists (
      select 1 from public.challenges as challenge
      where challenge.id = old.challenge_id
    ) then
      return old;
    end if;
    affected_ids := array[old.challenge_id];
  else
    affected_ids := array[old.challenge_id, new.challenge_id];
  end if;

  select count(distinct affected.challenge_id)::integer into affected_count
  from unnest(affected_ids) as affected(challenge_id);
  perform challenge.id
  from public.challenges as challenge
  where challenge.id = any(affected_ids)
  order by challenge.id
  for update of challenge;
  get diagnostics locked_count = row_count;

  if locked_count <> affected_count or exists (
    select 1 from public.challenges as challenge
    where challenge.id = any(affected_ids)
      and challenge.status = 'archived'
  ) then
    raise exception using errcode = '42501',
      message = 'Archived challenges cannot change group membership.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.delete_archived_group_challenge(target_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  challenge_row public.challenges%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;

  select challenge.* into challenge_row
  from public.challenges as challenge
  where challenge.id = target_challenge_id
  for update;

  if not found or challenge_row.owner_id <> actor_id
     or challenge_row.challenge_kind = 'personal' then
    raise exception using errcode = '42501', message = 'Archived group challenge ownership required.';
  end if;
  if challenge_row.status <> 'archived' then
    raise exception using errcode = '22023', message = 'Only archived group challenges can be permanently deleted.';
  end if;

  delete from public.challenges as challenge
  where challenge.id = target_challenge_id
    and challenge.owner_id = actor_id
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

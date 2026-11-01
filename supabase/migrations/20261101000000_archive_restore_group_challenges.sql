-- Issue #372: owner-controlled group archive and restore.
-- This is a reviewed migration file only. Hosted execution follows the release
-- workflow and is deliberately not performed by this task.
begin;

alter table public.challenges
  add column archived_from_status text,
  add constraint challenges_archived_from_status_check
    check (archived_from_status is null or archived_from_status in ('draft', 'active', 'completed')),
  add constraint challenges_archive_source_only_when_archived_check
    check (archived_from_status is null or status = 'archived');

create or replace function public.guard_group_challenge_archive_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  expected_status text;
begin
  if new.status = 'archived' then
    if new.challenge_kind = 'personal' then
      raise exception using errcode = '22023',
        message = 'Personal challenges cannot be archived as group challenges.';
    end if;

    if old.status is distinct from 'archived' then
      new.archived_from_status := old.status;
    else
      new.archived_from_status := old.archived_from_status;
    end if;
    return new;
  end if;

  if old.status = 'archived' then
    if old.end_date < current_date then
      expected_status := 'completed';
    elsif old.archived_from_status is not null then
      expected_status := case when old.archived_from_status = 'draft' then 'active' else old.archived_from_status end;
    else
      expected_status := new.status;
      if expected_status not in ('active', 'completed') then
        raise exception using errcode = '22023',
          message = 'Choose a valid status to restore this older archived challenge.';
      end if;
    end if;

    if new.status is distinct from expected_status then
      raise exception using errcode = '23514',
        message = 'Restore must use the prior status, or Completed after the end date.';
    end if;
    new.archived_from_status := null;
  else
    new.archived_from_status := null;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_group_challenge_archive_state() from public;

create trigger challenges_guard_archive_state
before update of status, archived_from_status on public.challenges
for each row execute function public.guard_group_challenge_archive_state();

create or replace function public.revoke_group_invites_when_archived()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status is distinct from 'archived' and new.status = 'archived' then
    update public.challenge_invites as invite
    set revoked_at = coalesce(invite.revoked_at, statement_timestamp()),
        updated_at = statement_timestamp()
    where invite.challenge_id = new.id
      and invite.revoked_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.revoke_group_invites_when_archived() from public;

create trigger challenges_revoke_invites_when_archived
after update of status on public.challenges
for each row execute function public.revoke_group_invites_when_archived();

-- Older archived challenges may predate automatic token revocation.
update public.challenge_invites as invite
set revoked_at = coalesce(invite.revoked_at, transaction_timestamp()),
    updated_at = transaction_timestamp()
from public.challenges as challenge
where challenge.id = invite.challenge_id
  and challenge.status = 'archived'
  and invite.revoked_at is null;

-- Owner-only server transitions. The row lock serializes archive/restore with
-- invitation, membership, target, and share writes.
create or replace function public.archive_group_challenge(target_challenge_id uuid)
returns setof public.challenges
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
    and challenge.owner_id = actor_id
    and challenge.challenge_kind is distinct from 'personal'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Group challenge ownership required.';
  end if;
  if challenge_row.status = 'archived' then
    raise exception using errcode = '22023', message = 'Challenge is already archived.';
  end if;

  update public.challenges as challenge
  set status = 'archived', updated_at = statement_timestamp()
  where challenge.id = target_challenge_id
  returning challenge.* into challenge_row;

  return next challenge_row;
end;
$$;

create or replace function public.restore_group_challenge(
  target_challenge_id uuid,
  target_restore_status text default null
)
returns setof public.challenges
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  challenge_row public.challenges%rowtype;
  restored_status text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;

  select challenge.* into challenge_row
  from public.challenges as challenge
  where challenge.id = target_challenge_id
    and challenge.owner_id = actor_id
    and challenge.challenge_kind is distinct from 'personal'
  for update;

  if not found or challenge_row.status <> 'archived' then
    raise exception using errcode = '42501', message = 'Archived group challenge ownership required.';
  end if;

  if challenge_row.end_date < current_date then
    restored_status := 'completed';
  elsif challenge_row.archived_from_status is not null then
    restored_status := case when challenge_row.archived_from_status = 'draft' then 'active' else challenge_row.archived_from_status end;
    if target_restore_status is not null
       and target_restore_status is distinct from restored_status then
      raise exception using errcode = '23514', message = 'Restore status does not match the archived challenge.';
    end if;
  else
    restored_status := target_restore_status;
    if restored_status is null or restored_status not in ('active', 'completed') then
      raise exception using errcode = '22023', message = 'Choose a valid status to restore this older archived challenge.';
    end if;
  end if;

  update public.challenges as challenge
  set status = restored_status,
      archived_from_status = null,
      updated_at = statement_timestamp()
  where challenge.id = target_challenge_id
  returning challenge.* into challenge_row;

  return next challenge_row;
end;
$$;

revoke all on function public.archive_group_challenge(uuid) from public, anon;
revoke all on function public.restore_group_challenge(uuid, text) from public, anon;
grant execute on function public.archive_group_challenge(uuid) to authenticated;
grant execute on function public.restore_group_challenge(uuid, text) to authenticated;

-- Challenge metadata is owner-editable while open, but lifecycle transitions
-- must use the guarded RPCs. Keep direct deletion unavailable until #373.
create policy challenges_no_archived_metadata_updates
  on public.challenges as restrictive
  for update to authenticated
  using (status <> 'archived')
  with check (status <> 'archived');

drop policy if exists challenges_delete_owned on public.challenges;
revoke delete on public.challenges from public, anon, authenticated;

-- RLS keeps every direct participant write closed once the group is archived.
create policy participants_not_archived_insert
  on public.participants as restrictive
  for insert to authenticated
  with check (exists (
    select 1 from public.challenges as challenge
    where challenge.id = participants.challenge_id
      and challenge.status <> 'archived'
  ));

create policy participants_not_archived_update
  on public.participants as restrictive
  for update to authenticated
  using (exists (
    select 1 from public.challenges as challenge
    where challenge.id = participants.challenge_id
      and challenge.status <> 'archived'
  ))
  with check (exists (
    select 1 from public.challenges as challenge
    where challenge.id = participants.challenge_id
      and challenge.status <> 'archived'
  ));

create policy participants_not_archived_delete
  on public.participants as restrictive
  for delete to authenticated
  using (exists (
    select 1 from public.challenges as challenge
    where challenge.id = participants.challenge_id
      and challenge.status <> 'archived'
  ));

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

revoke all on function public.guard_participant_archived_challenges() from public;
create trigger participants_guard_archived_challenge
before insert or update or delete on public.participants
for each row execute function public.guard_participant_archived_challenges();

-- The legacy participant weigh-in API is also a group-write path. Personal
-- weigh-ins continue through their own owner-only RPC and table.
create policy weigh_ins_not_archived_insert
  on public.weigh_ins as restrictive
  for insert to authenticated
  with check (exists (
    select 1
    from public.participants as participant
    join public.challenges as challenge on challenge.id = participant.challenge_id
    where participant.id = weigh_ins.participant_id
      and participant.user_id = auth.uid()
      and challenge.status <> 'archived'
  ));

create policy weigh_ins_not_archived_update
  on public.weigh_ins as restrictive
  for update to authenticated
  using (exists (
    select 1
    from public.participants as participant
    join public.challenges as challenge on challenge.id = participant.challenge_id
    where participant.id = weigh_ins.participant_id
      and participant.user_id = auth.uid()
      and challenge.status <> 'archived'
  ))
  with check (exists (
    select 1
    from public.participants as participant
    join public.challenges as challenge on challenge.id = participant.challenge_id
    where participant.id = weigh_ins.participant_id
      and participant.user_id = auth.uid()
      and challenge.status <> 'archived'
  ));

create policy weigh_ins_not_archived_delete
  on public.weigh_ins as restrictive
  for delete to authenticated
  using (exists (
    select 1
    from public.participants as participant
    join public.challenges as challenge on challenge.id = participant.challenge_id
    where participant.id = weigh_ins.participant_id
      and participant.user_id = auth.uid()
      and challenge.status <> 'archived'
  ));

create or replace function public.guard_weigh_in_archived_challenges()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  old_challenge_id uuid;
  new_challenge_id uuid;
  affected_ids uuid[];
  affected_count integer;
  locked_count integer;
begin
  if tg_op <> 'INSERT' then
    select participant.challenge_id into old_challenge_id
    from public.participants as participant
    where participant.id = old.participant_id;
  end if;
  if tg_op <> 'DELETE' then
    select participant.challenge_id into new_challenge_id
    from public.participants as participant
    where participant.id = new.participant_id;
  end if;

  affected_ids := array_remove(array[old_challenge_id, new_challenge_id], null);
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
      message = 'Archived challenges cannot change group weigh-ins.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_weigh_in_archived_challenges() from public;
create trigger weigh_ins_guard_archived_challenge
before insert or update or delete on public.weigh_ins
for each row execute function public.guard_weigh_in_archived_challenges();

-- Challenge invitation writes and acceptance serialize against archive.
create or replace function public.create_challenge_invite(
  target_challenge_id uuid,
  target_expires_at timestamptz
)
returns table (
  invite_id uuid,
  challenge_id uuid,
  expires_at timestamptz,
  token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  challenge_row public.challenges%rowtype;
  raw_token text;
  created_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select challenge.* into challenge_row
  from public.challenges as challenge
  where challenge.id = target_challenge_id
    and challenge.owner_id = auth.uid()
    and challenge.challenge_kind is distinct from 'personal'
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Challenge ownership required.';
  end if;
  if challenge_row.status = 'archived' then
    raise exception using errcode = '42501', message = 'Archived challenges cannot issue invitations.';
  end if;
  if target_expires_at <= now()
     or target_expires_at > now() + interval '30 days' then
    raise exception using errcode = '22023',
      message = 'Invitation expiry must be in the next 30 days.';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.challenge_invites (
    challenge_id, created_by, token_hash, expires_at
  ) values (
    target_challenge_id, auth.uid(),
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), target_expires_at
  ) returning id into created_invite_id;

  return query select created_invite_id, target_challenge_id, target_expires_at, raw_token;
end;
$$;

revoke all on function public.create_challenge_invite(uuid, timestamptz) from public, anon;
grant execute on function public.create_challenge_invite(uuid, timestamptz) to authenticated;

create or replace function public.preview_challenge_invite(invite_token text)
returns table (
  invite_id uuid,
  challenge_id uuid,
  challenge_name text,
  expires_at timestamptz,
  revoked_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.challenge_id, c.name, i.expires_at, i.revoked_at,
    case
      when i.revoked_at is not null or c.status = 'archived' then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'active'
    end
  from public.challenge_invites as i
  join public.challenges as c on c.id = i.challenge_id
  where i.token_hash = encode(extensions.digest(trim(invite_token), 'sha256'), 'hex');
$$;

revoke all on function public.preview_challenge_invite(text) from public;
grant execute on function public.preview_challenge_invite(text) to anon, authenticated;

create or replace function public.accept_challenge_invite(
  invite_token text,
  participant_display_name text,
  participant_starting_weight_kg numeric,
  participant_target_weight_kg numeric
)
returns public.participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  token_hash_value text := encode(extensions.digest(trim(invite_token), 'sha256'), 'hex');
  invite_challenge_id uuid;
  challenge_row public.challenges%rowtype;
  invite_row public.challenge_invites%rowtype;
  accepted_participant public.participants%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select invite.challenge_id into invite_challenge_id
  from public.challenge_invites as invite
  where invite.token_hash = token_hash_value;
  if not found then
    raise exception using errcode = 'P0004', message = 'Invitation is invalid.';
  end if;

  select challenge.* into challenge_row
  from public.challenges as challenge
  where challenge.id = invite_challenge_id
  for update;
  if not found or challenge_row.status = 'archived' then
    raise exception using errcode = 'P0002', message = 'Invitation is revoked.';
  end if;

  select invite.* into invite_row
  from public.challenge_invites as invite
  where invite.token_hash = token_hash_value
    and invite.challenge_id = invite_challenge_id
  for update;
  if not found or invite_row.revoked_at is not null then
    raise exception using errcode = 'P0002', message = 'Invitation is revoked.';
  end if;
  if invite_row.expires_at <= now() then
    raise exception using errcode = 'P0003', message = 'Invitation is expired.';
  end if;
  if trim(coalesce(participant_display_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Display name is required.';
  end if;
  if participant_starting_weight_kg is null or participant_starting_weight_kg <= 0
     or participant_target_weight_kg is null or participant_target_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'Weights must be positive.';
  end if;

  insert into public.profiles (id, display_name)
  values (actor_id, trim(participant_display_name))
  on conflict (id) do nothing;

  insert into public.participants as existing (
    challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values (
    invite_challenge_id, actor_id, trim(participant_display_name), 'active',
    participant_starting_weight_kg, participant_target_weight_kg, now()
  )
  on conflict (challenge_id, user_id) do update
  set display_name = excluded.display_name,
      status = 'active',
      starting_weight_kg = excluded.starting_weight_kg,
      target_weight_kg = excluded.target_weight_kg,
      joined_at = case
        when existing.withdrawn_at is not null then now()
        else coalesce(existing.joined_at, now())
      end,
      updated_at = now()
  where (
      existing.status = 'invited'
      and (existing.withdrawn_at is null or invite_row.created_at > existing.withdrawn_at)
    )
     or (
       existing.status = 'withdrawn'
       and invite_row.created_at > existing.withdrawn_at
     )
  returning * into accepted_participant;

  if not found then
    select participant.* into accepted_participant
    from public.participants as participant
    where participant.challenge_id = invite_challenge_id
      and participant.user_id = actor_id;
  end if;

  return accepted_participant;
end;
$$;

revoke all on function public.accept_challenge_invite(text, text, numeric, numeric) from public, anon;
grant execute on function public.accept_challenge_invite(text, text, numeric, numeric) to authenticated;

-- Group target and baseline mutations serialize with the archive transition.
create or replace function public.correct_my_enrollment_starting_weight(
  target_challenge_id uuid,
  target_starting_weight_kg numeric
)
returns table (
  challenge_id uuid,
  starting_weight_kg numeric,
  target_weight_kg numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  participant public.participants%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  select member.* into participant
  from public.participants as member
  join public.challenges as challenge on challenge.id = member.challenge_id
  where member.challenge_id = target_challenge_id
    and member.user_id = actor_id
    and member.status = 'active'
    and challenge.status <> 'archived'
    and (challenge.challenge_kind is distinct from 'personal' or challenge.owner_id = actor_id)
  for update of challenge, member;
  if not found then
    raise exception using errcode = '42501', message = 'Active enrollment access required.';
  end if;
  if target_starting_weight_kg is null
     or target_starting_weight_kg < 0.01
     or target_starting_weight_kg > 9999.99
     or target_starting_weight_kg <> round(target_starting_weight_kg, 2)
     or target_starting_weight_kg < participant.target_weight_kg then
    raise exception using errcode = '22023', message = 'Starting weight must be at least your current target, within the supported range, to two decimal places.';
  end if;
  update public.participants as member
  set starting_weight_kg = target_starting_weight_kg
  where member.id = participant.id
  returning member.challenge_id, member.starting_weight_kg, member.target_weight_kg
  into challenge_id, starting_weight_kg, target_weight_kg;
  return next;
end;
$$;

create or replace function public.change_my_group_target(
  target_challenge_id uuid,
  target_target_weight_kg numeric
)
returns table (
  challenge_id uuid,
  starting_weight_kg numeric,
  target_weight_kg numeric,
  previous_target_weight_kg numeric,
  previous_target_achieved_on date
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  participant public.participants%rowtype;
  qualifying_date date;
  reached boolean;
  previous_target numeric;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  select member.* into participant
  from public.participants as member
  join public.challenges as challenge on challenge.id = member.challenge_id
  where member.challenge_id = target_challenge_id
    and member.user_id = actor_id
    and member.status = 'active'
    and challenge.challenge_kind is distinct from 'personal'
    and challenge.status <> 'archived'
  for update of challenge, member;
  if not found then
    raise exception using errcode = '42501', message = 'Active group membership required.';
  end if;
  previous_target := participant.target_weight_kg;

  if target_target_weight_kg is null
     or target_target_weight_kg < 0.01
     or target_target_weight_kg > 9999.99
     or target_target_weight_kg <> round(target_target_weight_kg, 2)
     or target_target_weight_kg >= participant.starting_weight_kg then
    raise exception using errcode = '22023', message = 'Choose a target below your original starting weight, to two decimal places.';
  end if;

  select personal.recorded_date into qualifying_date
  from public.personal_weigh_in_group_shares as share
  join public.personal_weigh_ins as personal on personal.id = share.personal_weigh_in_id
  where share.challenge_id = target_challenge_id
    and personal.user_id = actor_id
    and personal.recorded_date >= participant.joined_at::date
    and personal.recorded_date <= current_date
    and personal.weight_kg <= participant.target_weight_kg
  order by personal.recorded_date, personal.id limit 1;

  reached := participant.target_weight_kg = participant.starting_weight_kg
    or qualifying_date is not null;
  if reached and target_target_weight_kg >= participant.target_weight_kg then
    raise exception using errcode = '22023', message = 'After reaching a target, choose a lower target.';
  end if;
  if target_target_weight_kg = participant.target_weight_kg then
    return query select participant.challenge_id, participant.starting_weight_kg,
      participant.target_weight_kg, null::numeric, null::date;
    return;
  end if;
  if reached then
    insert into public.participant_target_milestones (
      challenge_id, participant_id, target_weight_kg, achieved_on
    ) values (
      participant.challenge_id, participant.id, participant.target_weight_kg,
      qualifying_date
    );
  end if;
  update public.participants as member
  set target_weight_kg = target_target_weight_kg, updated_at = now()
  where member.id = participant.id
  returning member.target_weight_kg into participant.target_weight_kg;
  return query select participant.challenge_id, participant.starting_weight_kg,
    participant.target_weight_kg,
    case when reached then previous_target else null::numeric end,
    case when reached then qualifying_date else null::date end;
end;
$$;

revoke all on function public.correct_my_enrollment_starting_weight(uuid, numeric) from public, anon;
grant execute on function public.correct_my_enrollment_starting_weight(uuid, numeric) to authenticated;
revoke all on function public.change_my_group_target(uuid, numeric) from public, anon;
grant execute on function public.change_my_group_target(uuid, numeric) to authenticated;

-- Keep each user's edits personal while preserving the challenge-owned share
-- relation for archived groups. New shares are restricted to the same eligible
-- draft/active groups as before; archived share rows cannot be added or removed.
create or replace function public.save_personal_weigh_in(
  target_weigh_in_id uuid,
  target_recorded_date date,
  target_weight_kg numeric,
  target_note text,
  target_shared_challenge_ids uuid[]
)
returns table (
  id uuid,
  user_id uuid,
  recorded_date date,
  weight_kg numeric,
  note text,
  created_at timestamptz,
  updated_at timestamptz,
  shared_challenge_ids uuid[]
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  saved_id uuid;
  requested_ids uuid[] := coalesce(target_shared_challenge_ids, '{}'::uuid[]);
  requested_count integer;
  eligible_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_recorded_date is null or target_recorded_date > current_date
     or target_weight_kg is null or target_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'Invalid weigh-in values.';
  end if;
  if cardinality(requested_ids) <> (
    select count(distinct selected.challenge_id)
    from unnest(requested_ids) as selected(challenge_id)
  ) then
    raise exception using errcode = '22023', message = 'Duplicate group selection.';
  end if;
  requested_count := cardinality(requested_ids);

  if target_weigh_in_id is null then
    insert into public.personal_weigh_ins as current_entry (
      user_id, recorded_date, weight_kg, note
    ) values (
      actor_id, target_recorded_date, target_weight_kg, nullif(btrim(target_note), '')
    )
    on conflict on constraint personal_weigh_ins_user_date_unique do update set
      weight_kg = excluded.weight_kg,
      note = excluded.note,
      updated_at = now()
    returning current_entry.id into saved_id;
  else
    update public.personal_weigh_ins as current_entry
    set recorded_date = target_recorded_date,
        weight_kg = target_weight_kg,
        note = nullif(btrim(target_note), ''),
        updated_at = now()
    where current_entry.id = target_weigh_in_id
      and current_entry.user_id = actor_id
    returning current_entry.id into saved_id;
    if saved_id is null then
      raise exception using errcode = '42501', message = 'Weigh-in ownership required.';
    end if;
  end if;

  -- Lock every touched challenge in a stable order so archive and share writes
  -- serialize without changing a personal weigh-in's independent ownership.
  perform challenge.id
  from public.challenges as challenge
  where challenge.id = any(requested_ids)
     or exists (
       select 1 from public.personal_weigh_in_group_shares as share
       where share.personal_weigh_in_id = saved_id
         and share.challenge_id = challenge.id
     )
  order by challenge.id
  for update of challenge;

  select count(*) into eligible_count
  from public.challenges as challenge
  where challenge.id = any(requested_ids)
    and challenge.challenge_kind is distinct from 'personal'
    and (
      (challenge.status in ('draft', 'active') and (
        challenge.owner_id = actor_id
        or exists (
          select 1 from public.participants as participant
          where participant.challenge_id = challenge.id
            and participant.user_id = actor_id
            and participant.status = 'active'
        )
      ))
      or (challenge.status = 'archived' and exists (
        select 1 from public.personal_weigh_in_group_shares as prior_share
        where prior_share.personal_weigh_in_id = saved_id
          and prior_share.challenge_id = challenge.id
      ))
    );
  if eligible_count <> requested_count then
    raise exception using errcode = '42501', message = 'Group selection is no longer eligible.';
  end if;

  delete from public.personal_weigh_in_group_shares as share
  using public.challenges as challenge
  where share.personal_weigh_in_id = saved_id
    and challenge.id = share.challenge_id
    and challenge.status <> 'archived';

  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id, challenge_id)
  select saved_id, selected.challenge_id
  from unnest(requested_ids) as selected(challenge_id)
  join public.challenges as challenge on challenge.id = selected.challenge_id
  where challenge.status in ('draft', 'active')
  on conflict do nothing;

  return query
  select personal.id, personal.user_id, personal.recorded_date,
    personal.weight_kg, personal.note, personal.created_at, personal.updated_at,
    coalesce(array_agg(share.challenge_id order by share.challenge_id)
      filter (where share.challenge_id is not null), '{}'::uuid[])
  from public.personal_weigh_ins as personal
  left join public.personal_weigh_in_group_shares as share
    on share.personal_weigh_in_id = personal.id
  where personal.id = saved_id
  group by personal.id;
end;
$$;

commit;

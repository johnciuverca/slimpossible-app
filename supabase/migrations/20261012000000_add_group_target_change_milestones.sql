-- Issue #257: member-owned group target changes and shared reached-target history.
-- Additive local-review migration. Hosted application requires the separate release gate.
begin;

create table public.participant_target_milestones (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  target_weight_kg numeric(6, 2) not null check (target_weight_kg > 0),
  achieved_on date,
  created_at timestamptz not null default now()
);

create index participant_target_milestones_challenge_participant_idx
  on public.participant_target_milestones (challenge_id, participant_id, achieved_on);

alter table public.participant_target_milestones enable row level security;
revoke all on public.participant_target_milestones from public, anon, authenticated;

-- Change only the caller's active participant row. Reached milestones are
-- snapshotted privately; the group RPC below revalidates explicit shared
-- evidence on every read before making a milestone visible.
create function public.change_my_group_target(
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
  if target_challenge_id is null then
    raise exception using errcode = '22023', message = 'A selected group is required.';
  end if;

  select member.* into participant
  from public.participants as member
  join public.challenges as challenge on challenge.id = member.challenge_id
  where member.challenge_id = target_challenge_id
    and member.user_id = actor_id
    and member.status = 'active'
    and challenge.challenge_kind is distinct from 'personal'
  for update of member;

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
  join public.personal_weigh_ins as personal
    on personal.id = share.personal_weigh_in_id
  where share.challenge_id = target_challenge_id
    and personal.user_id = actor_id
    and personal.recorded_date >= participant.joined_at::date
    and personal.recorded_date <= current_date
    and personal.weight_kg <= participant.target_weight_kg
  order by personal.recorded_date, personal.id
  limit 1;

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
  set target_weight_kg = target_target_weight_kg,
      updated_at = now()
  where member.id = participant.id
  returning member.target_weight_kg into participant.target_weight_kg;

  return query select participant.challenge_id, participant.starting_weight_kg,
    participant.target_weight_kg,
    case when reached then previous_target
      else null::numeric end,
    case when reached then qualifying_date else null::date end;
end;
$$;

-- Private history is readable only by the participant who owns the row.
create function public.list_my_group_target_milestones(target_challenge_id uuid)
returns table (
  target_weight_kg numeric,
  achieved_on date,
  state text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_challenge_id is null or not exists (
    select 1 from public.participants as member
    join public.challenges as challenge on challenge.id = member.challenge_id
    where member.challenge_id = target_challenge_id
      and member.user_id = auth.uid()
      and challenge.challenge_kind is distinct from 'personal'
  ) then
    raise exception using errcode = '42501', message = 'Challenge ownership required.';
  end if;

  return query
  select milestone.target_weight_kg, milestone.achieved_on, 'reached'::text
  from public.participant_target_milestones as milestone
  join public.participants as member on member.id = milestone.participant_id
  where milestone.challenge_id = target_challenge_id
    and member.user_id = auth.uid()
  order by milestone.created_at, milestone.id;
end;
$$;

-- Group-visible history contains no entry weights, IDs, notes or other-group data.
-- A milestone is returned only while a qualifying explicitly shared measurement
-- remains available in this challenge; the displayed date is re-derived from it.
create function public.get_group_target_milestones(target_challenge_id uuid)
returns table (
  member_key text,
  display_name text,
  target_weight_kg numeric,
  achieved_on date,
  state text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as viewer
        where viewer.challenge_id = challenge.id
          and viewer.user_id = auth.uid()
          and viewer.status = 'active'
      ))
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  select md5(target_challenge_id::text || ':' || member.user_id::text),
    coalesce(member.display_name, profile.display_name, 'Member'),
    milestone.target_weight_kg, evidence.recorded_date, 'reached'::text
  from public.participant_target_milestones as milestone
  join public.participants as member on member.id = milestone.participant_id
  join public.profiles as profile on profile.id = member.user_id
  join lateral (
    select personal.recorded_date
    from public.personal_weigh_in_group_shares as share
    join public.personal_weigh_ins as personal
      on personal.id = share.personal_weigh_in_id
    where share.challenge_id = target_challenge_id
      and personal.user_id = member.user_id
      and personal.recorded_date >= member.joined_at::date
      and personal.recorded_date <= current_date
      and personal.weight_kg <= milestone.target_weight_kg
    order by personal.recorded_date, personal.id
    limit 1
  ) as evidence on true
  where milestone.challenge_id = target_challenge_id
    and member.status = 'active'
  order by evidence.recorded_date, 1, milestone.target_weight_kg;
end;
$$;

revoke all on function public.change_my_group_target(uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.list_my_group_target_milestones(uuid)
  from public, anon, authenticated;
revoke all on function public.get_group_target_milestones(uuid)
  from public, anon, authenticated;
grant execute on function public.change_my_group_target(uuid, numeric)
  to authenticated;
grant execute on function public.list_my_group_target_milestones(uuid)
  to authenticated;
grant execute on function public.get_group_target_milestones(uuid)
  to authenticated;

commit;

-- Non-destructive application rollback for Issue #210.
-- Run only after rolling the app client back, on the same database where
-- migration 20261007000000_personal_weigh_ins.sql was applied.
--
-- This restores the RPC bodies that #210 replaced. It deliberately does NOT
-- drop canonical tables, rows, shares, provenance, or personal RPCs. Entries
-- created after rollout remain in personal_weigh_ins; do not infer a legacy
-- participant/challenge for private entries or flatten them into weigh_ins.
-- Old clients will not display canonical-only entries; preserve this data so
-- a later forward rollout can resume from it. Take a verified backup first.

begin;

create or replace function public.get_group_weigh_in_history(
  target_challenge_id uuid
)
returns table (
  display_name text,
  recorded_date date,
  weight_kg numeric,
  change_since_previous_kg numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  if not exists (
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
  with shared_history as (
    select participant.display_name, weigh_in.participant_id,
      weigh_in.recorded_date, weigh_in.weight_kg,
      lag(weigh_in.weight_kg) over (
        partition by weigh_in.participant_id order by weigh_in.recorded_date
      ) as previous_shared_weight
    from public.weigh_ins as weigh_in
    join public.participants as participant
      on participant.id = weigh_in.participant_id
    join public.challenges as challenge
      on challenge.id = participant.challenge_id
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and participant.status = 'active'
      and weigh_in.share_with_group
      and weigh_in.recorded_date <= current_date
  )
  select history.display_name, history.recorded_date, history.weight_kg,
    history.weight_kg - history.previous_shared_weight
  from shared_history as history
  order by history.recorded_date desc, history.display_name;
end;
$$;

create or replace function public.get_group_progress_summary(
  target_challenge_id uuid,
  target_current_sunday date
)
returns table (
  challenge_id uuid,
  current_sunday date,
  previous_sunday date,
  active_participant_count bigint,
  participants_with_recorded_weight_count bigint,
  participants_with_progress_count bigint,
  average_completion_percentage numeric,
  reached_target_count bigint,
  eligible_participant_count bigint,
  weekly_winner_count bigint,
  weekly_winner_names text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  if target_current_sunday is null
     or extract(dow from target_current_sunday) <> 0 then
    raise exception using errcode = '22023', message = 'The requested week must end on a Sunday.';
  end if;
  if not exists (
    select 1 from public.participants as member
    where member.challenge_id = target_challenge_id
      and member.user_id = auth.uid() and member.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  with active_participants as (
    select participant.id, participant.display_name,
      participant.starting_weight_kg, participant.target_weight_kg
    from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), latest_weigh_ins as (
    select distinct on (weigh_in.participant_id) weigh_in.participant_id,
      weigh_in.recorded_date, weigh_in.weight_kg
    from public.weigh_ins as weigh_in
    join active_participants as participant
      on participant.id = weigh_in.participant_id
    order by weigh_in.participant_id, weigh_in.recorded_date desc
  ), participant_progress as (
    select participant.id, latest.recorded_date is not null as has_record,
      case
        when latest.recorded_date is null then null
        when participant.target_weight_kg < participant.starting_weight_kg then
          greatest(0::numeric, least(100::numeric,
            ((participant.starting_weight_kg - latest.weight_kg)
              / (participant.starting_weight_kg - participant.target_weight_kg)) * 100
          ))
        when participant.target_weight_kg > participant.starting_weight_kg then
          greatest(0::numeric, least(100::numeric,
            ((latest.weight_kg - participant.starting_weight_kg)
              / (participant.target_weight_kg - participant.starting_weight_kg)) * 100
          ))
        when latest.weight_kg = participant.target_weight_kg then 100::numeric
        else 0::numeric
      end as completion_percentage
    from active_participants as participant
    left join latest_weigh_ins as latest on latest.participant_id = participant.id
  ), weekly_candidates as (
    select participant.display_name,
      current_record.weight_kg - previous_record.weight_kg as weight_change
    from active_participants as participant
    join public.weigh_ins as previous_record
      on previous_record.participant_id = participant.id
     and previous_record.recorded_date = target_current_sunday - 7
    join public.weigh_ins as current_record
      on current_record.participant_id = participant.id
     and current_record.recorded_date = target_current_sunday
  ), best_weekly_change as (
    select min(candidate.weight_change) as weight_change from weekly_candidates candidate
  ), weekly_winners as (
    select count(candidate.display_name) as winner_count,
      coalesce(array_agg(candidate.display_name order by candidate.display_name)
        filter (where candidate.display_name is not null), array[]::text[]) as winner_names
    from weekly_candidates candidate cross join best_weekly_change best
    where candidate.weight_change = best.weight_change
  ), group_summary as (
    select count(*) as active_count,
      count(*) filter (where progress.has_record) as recorded_count,
      count(*) filter (where progress.completion_percentage is not null) as progress_count,
      round(avg(progress.completion_percentage), 1) as average_completion,
      count(*) filter (where progress.completion_percentage = 100) as reached_count
    from participant_progress progress
  )
  select target_challenge_id, target_current_sunday, target_current_sunday - 7,
    group_summary.active_count, group_summary.recorded_count,
    group_summary.progress_count, group_summary.average_completion,
    group_summary.reached_count, (select count(*) from weekly_candidates),
    weekly_winners.winner_count, weekly_winners.winner_names
  from group_summary cross join weekly_winners;
end;
$$;

create or replace function public.get_provisional_group_leader_summary(
  target_challenge_id uuid,
  target_current_date date
)
returns table (
  challenge_id uuid,
  current_week_start date,
  current_week_end date,
  previous_sunday date,
  active_participant_count bigint,
  eligible_participant_count bigint,
  leader_count bigint,
  leader_names text[],
  leader_latest_dates date[],
  state text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  week_start date;
  week_end date;
  baseline_date date;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  if target_current_date is null then
    raise exception using errcode = '22023', message = 'A current date is required.';
  end if;
  if not exists (
    select 1 from public.participants as member
    where member.challenge_id = target_challenge_id
      and member.user_id = auth.uid() and member.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  week_start := target_current_date - (extract(isodow from target_current_date)::integer - 1);
  week_end := week_start + 6;
  baseline_date := week_start - 1;

  return query
  with active_participants as (
    select participant.id, participant.display_name
    from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), latest_current_week as (
    select distinct on (weigh_in.participant_id) weigh_in.participant_id,
      weigh_in.recorded_date, weigh_in.weight_kg
    from public.weigh_ins as weigh_in
    join active_participants as participant on participant.id = weigh_in.participant_id
    where weigh_in.recorded_date between week_start and week_end
      and weigh_in.recorded_date <= target_current_date
    order by weigh_in.participant_id, weigh_in.recorded_date desc
  ), candidates as (
    select participant.display_name, latest.recorded_date as latest_date,
      latest.weight_kg - baseline.weight_kg as weight_change
    from active_participants as participant
    join public.weigh_ins as baseline
      on baseline.participant_id = participant.id
     and baseline.recorded_date = baseline_date
    join latest_current_week as latest on latest.participant_id = participant.id
  ), counts as (
    select (select count(*) from active_participants) as active_count,
      (select count(*) from candidates) as eligible_count
  ), best_change as (
    select min(candidate.weight_change) as weight_change from candidates candidate
  ), leaders as (
    select candidate.display_name, candidate.latest_date
    from candidates candidate cross join best_change best
    where candidate.weight_change = best.weight_change
  ), leader_arrays as (
    select count(*) as count,
      coalesce(array_agg(leader.display_name order by leader.display_name), array[]::text[]) as names,
      coalesce(array_agg(leader.latest_date order by leader.display_name), array[]::date[]) as dates
    from leaders leader
  )
  select target_challenge_id, week_start, week_end, baseline_date,
    counts.active_count, counts.eligible_count,
    case when counts.active_count <= 1 then 0 else leader_arrays.count end,
    case when counts.active_count <= 1 then array[]::text[] else leader_arrays.names end,
    case when counts.active_count <= 1 then array[]::date[] else leader_arrays.dates end,
    case when counts.active_count <= 1 then 'solo-challenge'
      when counts.eligible_count = 0 then 'no-eligible-candidates' else 'leaders' end
  from counts cross join leader_arrays;
end;
$$;

create or replace function public.get_challenge_progress_summary(
  target_challenge_id uuid
)
returns table (
  challenge_id uuid,
  active_participant_count bigint,
  participants_with_recorded_weight_count bigint,
  total_weigh_in_count bigint,
  latest_recorded_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select challenge.id,
    count(distinct participant.id) filter (where participant.status = 'active'),
    count(distinct participant.id) filter (where weigh_in.id is not null),
    count(weigh_in.id),
    max(weigh_in.recorded_date)
  from public.challenges as challenge
  left join public.participants as participant
    on participant.challenge_id = challenge.id and participant.status = 'active'
  left join public.weigh_ins as weigh_in
    on weigh_in.participant_id = participant.id
  where challenge.id = target_challenge_id
    and challenge.owner_id = auth.uid()
  group by challenge.id;
$$;

commit;

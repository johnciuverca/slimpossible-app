-- Restore the prior active-member-only summary authorization.
-- Function ACLs and data remain unchanged.
begin;

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
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_current_sunday is null
     or extract(dow from target_current_sunday) <> 0
     or target_current_sunday > current_date then
    raise exception using errcode = '22023', message = 'A current or past Sunday is required.';
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
    select participant.id, participant.user_id, participant.display_name,
      participant.starting_weight_kg, participant.target_weight_kg
    from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), latest_weigh_ins as (
    select distinct on (participant.id) participant.id,
      personal.recorded_date, personal.weight_kg
    from active_participants as participant
    join public.personal_weigh_in_group_shares as share
      on share.challenge_id = target_challenge_id
    join public.personal_weigh_ins as personal
      on personal.id = share.personal_weigh_in_id
     and personal.user_id = participant.user_id
     and personal.recorded_date <= current_date
    order by participant.id, personal.recorded_date desc
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
    left join latest_weigh_ins as latest on latest.id = participant.id
  ), weekly_candidates as (
    select participant.display_name,
      current_entry.weight_kg - previous_entry.weight_kg as weight_change
    from active_participants as participant
    join public.personal_weigh_ins as previous_entry
      on previous_entry.user_id = participant.user_id
     and previous_entry.recorded_date = target_current_sunday - 7
    join public.personal_weigh_in_group_shares as previous_share
      on previous_share.personal_weigh_in_id = previous_entry.id
     and previous_share.challenge_id = target_challenge_id
    join public.personal_weigh_ins as current_entry
      on current_entry.user_id = participant.user_id
     and current_entry.recorded_date = target_current_sunday
    join public.personal_weigh_in_group_shares as current_share
      on current_share.personal_weigh_in_id = current_entry.id
     and current_share.challenge_id = target_challenge_id
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
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_current_date is null or target_current_date > current_date then
    raise exception using errcode = '22023', message = 'A current or past date is required.';
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
    select participant.id, participant.user_id, participant.display_name
    from public.participants as participant
    where participant.challenge_id = target_challenge_id and participant.status = 'active'
  ), latest_current_week as (
    select distinct on (participant.id) participant.id,
      personal.recorded_date, personal.weight_kg
    from active_participants participant
    join public.personal_weigh_ins personal on personal.user_id = participant.user_id
    join public.personal_weigh_in_group_shares share
      on share.personal_weigh_in_id = personal.id
     and share.challenge_id = target_challenge_id
    where personal.recorded_date between week_start and week_end
      and personal.recorded_date <= target_current_date
    order by participant.id, personal.recorded_date desc
  ), candidates as (
    select participant.display_name, latest.recorded_date as latest_date,
      latest.weight_kg - baseline.weight_kg as weight_change
    from active_participants participant
    join public.personal_weigh_ins baseline
      on baseline.user_id = participant.user_id
     and baseline.recorded_date = baseline_date
    join public.personal_weigh_in_group_shares baseline_share
      on baseline_share.personal_weigh_in_id = baseline.id
     and baseline_share.challenge_id = target_challenge_id
    join latest_current_week latest on latest.id = participant.id
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

revoke all on function public.get_group_progress_summary(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_group_progress_summary(uuid, date)
  to authenticated;
revoke all on function public.get_provisional_group_leader_summary(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_provisional_group_leader_summary(uuid, date)
  to authenticated;

commit;

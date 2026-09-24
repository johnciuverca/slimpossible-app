-- Return only aggregate group progress and weekly winner display names.
-- Individual weigh-ins and private notes never cross this database boundary.
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
    raise exception using
      errcode = '22023',
      message = 'The requested week must end on a Sunday.';
  end if;

  -- Do not distinguish an unknown challenge from a challenge the caller
  -- cannot access. Only active members, not owners-only or invited users, qualify.
  if not exists (
    select 1
    from public.participants as member
    where member.challenge_id = target_challenge_id
      and member.user_id = auth.uid()
      and member.status = 'active'
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
    select distinct on (weigh_in.participant_id)
      weigh_in.participant_id,
      weigh_in.recorded_date,
      weigh_in.weight_kg
    from public.weigh_ins as weigh_in
    join active_participants as participant
      on participant.id = weigh_in.participant_id
    order by weigh_in.participant_id, weigh_in.recorded_date desc
  ), participant_progress as (
    select participant.id,
      latest.recorded_date is not null as has_record,
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
    left join latest_weigh_ins as latest
      on latest.participant_id = participant.id
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
    select min(candidate.weight_change) as weight_change
    from weekly_candidates as candidate
  ), weekly_winners as (
    select
      count(candidate.display_name) as winner_count,
      coalesce(
        array_agg(candidate.display_name order by candidate.display_name)
          filter (where candidate.display_name is not null),
        array[]::text[]
      ) as winner_names
    from weekly_candidates as candidate
    cross join best_weekly_change as best
    where candidate.weight_change = best.weight_change
  ), group_summary as (
    select
      count(*) as active_count,
      count(*) filter (where progress.has_record) as recorded_count,
      count(*) filter (where progress.completion_percentage is not null)
        as progress_count,
      round(avg(progress.completion_percentage), 1) as average_completion,
      count(*) filter (where progress.completion_percentage = 100)
        as reached_count
    from participant_progress as progress
  )
  select
    target_challenge_id,
    target_current_sunday,
    target_current_sunday - 7,
    group_summary.active_count,
    group_summary.recorded_count,
    group_summary.progress_count,
    group_summary.average_completion,
    group_summary.reached_count,
    (select count(*) from weekly_candidates),
    weekly_winners.winner_count,
    weekly_winners.winner_names
  from group_summary
  cross join weekly_winners;
end;
$$;

revoke all on function public.get_group_progress_summary(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_group_progress_summary(uuid, date) to authenticated;

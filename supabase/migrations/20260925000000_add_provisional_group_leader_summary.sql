-- Expose only the provisional leader names, comparison dates, and counts.
-- The existing final Sunday-to-Sunday winner RPC is intentionally unchanged.
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
    select 1
    from public.participants as member
    where member.challenge_id = target_challenge_id
      and member.user_id = auth.uid()
      and member.status = 'active'
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
    select distinct on (weigh_in.participant_id)
      weigh_in.participant_id,
      weigh_in.recorded_date,
      weigh_in.weight_kg
    from public.weigh_ins as weigh_in
    join active_participants as participant on participant.id = weigh_in.participant_id
    where weigh_in.recorded_date between week_start and week_end
    order by weigh_in.participant_id, weigh_in.recorded_date desc
  ), candidates as (
    select participant.display_name,
      latest.recorded_date as latest_date,
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
    select min(candidate.weight_change) as weight_change from candidates as candidate
  ), leaders as (
    select candidate.display_name, candidate.latest_date
    from candidates as candidate
    cross join best_change as best
    where candidate.weight_change = best.weight_change
  ), leader_arrays as (
    select count(*) as count,
      coalesce(array_agg(leader.display_name order by leader.display_name), array[]::text[]) as names,
      coalesce(array_agg(leader.latest_date order by leader.display_name), array[]::date[]) as dates
    from leaders as leader
  )
  select target_challenge_id, week_start, week_end, baseline_date,
    counts.active_count,
    counts.eligible_count,
    case when counts.active_count <= 1 then 0 else leader_arrays.count end,
    case when counts.active_count <= 1 then array[]::text[] else leader_arrays.names end,
    case when counts.active_count <= 1 then array[]::date[] else leader_arrays.dates end,
    case
      when counts.active_count <= 1 then 'solo-challenge'
      when counts.eligible_count = 0 then 'no-eligible-candidates'
      else 'leaders'
    end
  from counts
  cross join leader_arrays;
end;
$$;

revoke all on function public.get_provisional_group_leader_summary(uuid, date)
  from public, anon, authenticated;
grant execute on function public.get_provisional_group_leader_summary(uuid, date)
  to authenticated;

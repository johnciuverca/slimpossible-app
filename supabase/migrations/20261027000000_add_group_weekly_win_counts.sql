-- Count completed weekly wins from the same shared Sunday weigh-ins used by
-- the group weekly result. Counts are derived, so refreshes cannot add wins.
begin;

-- One source of truth for an eligible member's weekly result and tied wins.
create or replace function public._get_group_weekly_result(
  target_challenge_id uuid,
  target_current_sunday date
)
returns table (
  participant_id uuid,
  display_name text,
  is_winner boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with candidates as (
    select participant.id, participant.display_name,
      current_entry.weight_kg - previous_entry.weight_kg as weight_change
    from public.participants as participant
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
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), best as (
    select min(candidate.weight_change) as weight_change from candidates as candidate
  )
  select candidate.id, candidate.display_name,
    candidate.weight_change = best.weight_change
  from candidates as candidate cross join best;
$$;

revoke all on function public._get_group_weekly_result(uuid, date)
  from public, anon, authenticated;

-- Keep the existing weekly result endpoint on the shared winner calculation.
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
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (
        challenge.owner_id = auth.uid()
        or exists (
          select 1 from public.participants as member
          where member.challenge_id = challenge.id
            and member.user_id = auth.uid()
            and member.status = 'active'
        )
      )
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
    select result.participant_id, result.display_name, result.is_winner
    from public._get_group_weekly_result(target_challenge_id, target_current_sunday) as result
  ), weekly_winners as (
    select count(*) filter (where candidate.is_winner) as winner_count,
      coalesce(array_agg(candidate.display_name order by candidate.display_name)
        filter (where candidate.is_winner), array[]::text[]) as winner_names
    from weekly_candidates as candidate
  ), group_summary as (
    select count(*) as active_count,
      count(*) filter (where progress.has_record) as recorded_count,
      count(*) filter (where progress.completion_percentage is not null) as progress_count,
      round(avg(progress.completion_percentage), 1) as average_completion,
      count(*) filter (where progress.completion_percentage = 100) as reached_count
    from participant_progress as progress
  )
  select target_challenge_id, target_current_sunday, target_current_sunday - 7,
    group_summary.active_count, group_summary.recorded_count,
    group_summary.progress_count, group_summary.average_completion,
    group_summary.reached_count, (select count(*) from weekly_candidates),
    weekly_winners.winner_count, weekly_winners.winner_names
  from group_summary cross join weekly_winners;
end;
$$;

create or replace function public.get_group_weekly_win_counts(
  target_challenge_id uuid
)
returns table (
  member_key text,
  display_name text,
  win_count bigint
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
  if not exists (
    select 1
    from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (
        challenge.owner_id = auth.uid()
        or exists (
          select 1 from public.participants as member
          where member.challenge_id = challenge.id
            and member.user_id = auth.uid()
            and member.status = 'active'
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  with active_participants as (
    select participant.id, participant.user_id, participant.display_name
    from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), completed_sundays as (
    select distinct current_entry.recorded_date as current_sunday
    from public.personal_weigh_ins as current_entry
    join public.personal_weigh_in_group_shares as current_share
      on current_share.personal_weigh_in_id = current_entry.id
     and current_share.challenge_id = target_challenge_id
    where extract(dow from current_entry.recorded_date) = 0
      and current_entry.recorded_date < current_date
  ), weekly_results as (
    select sunday.current_sunday, result.participant_id, result.display_name,
      result.is_winner
    from completed_sundays as sunday
    cross join lateral public._get_group_weekly_result(
      target_challenge_id, sunday.current_sunday
    ) as result
  ), weekly_winners as (
    select result.participant_id,
      count(distinct result.current_sunday) filter (where result.is_winner) as win_count
    from weekly_results as result
    group by result.participant_id
  )
  select md5(target_challenge_id::text || ':' || participant.user_id::text),
    participant.display_name, coalesce(winner.win_count, 0)::bigint
  from active_participants as participant
  left join weekly_winners as winner on winner.participant_id = participant.id
  order by participant.display_name, participant.id;
end;
$$;

revoke all on function public.get_group_weekly_win_counts(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_weekly_win_counts(uuid)
  to authenticated;

commit;

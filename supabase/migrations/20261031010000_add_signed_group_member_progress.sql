-- Issue #336: add a bounded signed display value to the authorized per-member
-- projection. Keep the clamped completion value and private weigh-in data intact.
begin;

drop function public.get_group_member_progress(uuid);

create function public.get_group_member_progress(target_challenge_id uuid)
returns table (
  member_key text,
  display_name text,
  starting_weight_kg numeric,
  target_weight_kg numeric,
  latest_recorded_date date,
  completion_percentage numeric,
  progress_state text,
  reached_target_milestones jsonb,
  signed_display_percentage numeric,
  negative_progress_capped boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1
        from public.participants as viewer
        where viewer.challenge_id = challenge.id
          and viewer.user_id = auth.uid()
          and viewer.status = 'active'
      ))
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  select
    md5(target_challenge_id::text || ':' || member.user_id::text),
    coalesce(member.display_name, profile.display_name, 'Member'),
    member.starting_weight_kg,
    member.target_weight_kg,
    latest.recorded_date,
    case
      when member.starting_weight_kg is null or member.starting_weight_kg <= 0
        or member.target_weight_kg is null or member.target_weight_kg <= 0
        or member.target_weight_kg > member.starting_weight_kg then null::numeric
      when member.target_weight_kg = member.starting_weight_kg then 100::numeric
      when latest.recorded_date is null then null::numeric
      when latest.weight_kg <= member.target_weight_kg then 100::numeric
      else round(greatest(0::numeric, least(100::numeric,
        ((member.starting_weight_kg - latest.weight_kg)
          / (member.starting_weight_kg - member.target_weight_kg)) * 100
      )), 1)
    end,
    case
      when member.starting_weight_kg is null or member.starting_weight_kg <= 0
        or member.target_weight_kg is null or member.target_weight_kg <= 0
        or member.target_weight_kg > member.starting_weight_kg then 'unavailable'
      when member.target_weight_kg = member.starting_weight_kg then 'reached'
      when latest.recorded_date is null then 'unavailable'
      when latest.weight_kg <= member.target_weight_kg then 'reached'
      else 'in_progress'
    end,
    coalesce(milestones.items, '[]'::jsonb),
    case
      when member.starting_weight_kg is null or member.starting_weight_kg <= 0
        or member.target_weight_kg is null or member.target_weight_kg <= 0
        or member.target_weight_kg > member.starting_weight_kg then null::numeric
      when member.target_weight_kg = member.starting_weight_kg then 100::numeric
      when latest.recorded_date is null then null::numeric
      when latest.weight_kg <= member.target_weight_kg then 100::numeric
      else round(greatest(-100::numeric, least(100::numeric,
        ((member.starting_weight_kg - latest.weight_kg)
          / (member.starting_weight_kg - member.target_weight_kg)) * 100
      )), 1)
    end,
    case
      when member.starting_weight_kg is null or member.starting_weight_kg <= 0
        or member.target_weight_kg is null or member.target_weight_kg <= 0
        or member.target_weight_kg >= member.starting_weight_kg
        or latest.recorded_date is null then false
      else ((member.starting_weight_kg - latest.weight_kg)
        / (member.starting_weight_kg - member.target_weight_kg)) * 100 < -100
    end
  from public.participants as member
  join public.profiles as profile on profile.id = member.user_id
  left join lateral (
    select personal.recorded_date, personal.weight_kg
    from public.personal_weigh_in_group_shares as share
    join public.personal_weigh_ins as personal
      on personal.id = share.personal_weigh_in_id
    where share.challenge_id = target_challenge_id
      and personal.user_id = member.user_id
      and personal.recorded_date >= member.joined_at::date
      and personal.recorded_date <= current_date
    order by personal.recorded_date desc, personal.id desc
    limit 1
  ) as latest on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'target_weight_kg', milestone.target_weight_kg,
      'achieved_on', evidence.recorded_date,
      'state', 'reached'
    ) order by evidence.recorded_date, milestone.target_weight_kg) as items
    from public.participant_target_milestones as milestone
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
      and milestone.participant_id = member.id
  ) as milestones on true
  where member.challenge_id = target_challenge_id
    and member.status = 'active'
  order by 1;
end;
$$;

revoke all on function public.get_group_member_progress(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_member_progress(uuid)
  to authenticated;

commit;

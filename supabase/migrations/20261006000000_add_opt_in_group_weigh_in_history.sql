-- Sharing is opt-in per weigh-in. Existing rows remain private because the
-- new flag defaults false; no historical rows are automatically backfilled.
begin;

alter table public.weigh_ins
  add column share_with_group boolean not null default false;

comment on column public.weigh_ins.share_with_group is
  'Explicit per-entry permission to show only this date and weight to active members and the owner of its group challenge. Notes remain private.';

-- Raw weigh_ins access remains participant-only. This function exposes a
-- deliberately narrow projection and calculates deltas only from previously
-- shared, non-future rows within the same challenge and participant.
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
    select 1
    from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (
        challenge.owner_id = auth.uid()
        or exists (
          select 1
          from public.participants as viewer
          where viewer.challenge_id = challenge.id
            and viewer.user_id = auth.uid()
            and viewer.status = 'active'
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  with shared_history as (
    select participant.display_name,
      weigh_in.participant_id,
      weigh_in.recorded_date,
      weigh_in.weight_kg,
      lag(weigh_in.weight_kg) over (
        partition by weigh_in.participant_id
        order by weigh_in.recorded_date
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
  select history.display_name,
    history.recorded_date,
    history.weight_kg,
    history.weight_kg - history.previous_shared_weight
  from shared_history as history
  order by history.recorded_date desc, history.display_name;
end;
$$;

revoke all on function public.get_group_weigh_in_history(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_weigh_in_history(uuid)
  to authenticated;

commit;

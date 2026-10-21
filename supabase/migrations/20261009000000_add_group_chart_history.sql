-- #211: stable, group-scoped chart identity without raw user/participant IDs.
-- Additive RPC; no backfill, policy widening or ranking changes.
-- Hosted execution requires separate owner approval and verified backup.
begin;

create function public.get_group_chart_history(target_challenge_id uuid)
returns table (
  member_key text,
  display_name text,
  recorded_date date,
  weight_kg numeric
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
  select md5(target_challenge_id::text || ':' || personal.user_id::text),
    coalesce(participant.display_name, profile.display_name, 'Member'),
    personal.recorded_date, personal.weight_kg
  from public.personal_weigh_in_group_shares as share
  join public.personal_weigh_ins as personal on personal.id = share.personal_weigh_in_id
  join public.challenges as challenge on challenge.id = share.challenge_id
  join public.profiles as profile on profile.id = personal.user_id
  left join public.participants as participant
    on participant.challenge_id = share.challenge_id
   and participant.user_id = personal.user_id
  where share.challenge_id = target_challenge_id
    and personal.recorded_date <= current_date
    and (challenge.owner_id = personal.user_id or exists (
      select 1 from public.participants as author
      where author.challenge_id = challenge.id
        and author.user_id = personal.user_id
        and author.status = 'active'
    ))
  order by personal.recorded_date, 1;
end;
$$;

revoke all on function public.get_group_chart_history(uuid) from public, anon;
grant execute on function public.get_group_chart_history(uuid) to authenticated;
commit;

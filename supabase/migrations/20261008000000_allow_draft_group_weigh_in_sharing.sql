-- #210 compatibility correction; hosted execution requires separate approval.
-- Replace only the save RPC. No data backfill or challenge-status edits.
-- CREATE OR REPLACE preserves the existing restricted function ACL.
begin;

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
  select count(*) into eligible_count
  from public.challenges as challenge
  where challenge.id = any(requested_ids)
    and challenge.challenge_kind is distinct from 'personal'
    and challenge.status in ('draft', 'active')
    and (
      challenge.owner_id = actor_id
      or exists (
        select 1 from public.participants as participant
        where participant.challenge_id = challenge.id
          and participant.user_id = actor_id
          and participant.status = 'active'
      )
    );
  if eligible_count <> requested_count then
    raise exception using errcode = '42501', message = 'Group selection is no longer eligible.';
  end if;

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

  delete from public.personal_weigh_in_group_shares as share
  where share.personal_weigh_in_id = saved_id;
  insert into public.personal_weigh_in_group_shares (
    personal_weigh_in_id, challenge_id
  )
  select saved_id, selected.challenge_id
  from unnest(requested_ids) as selected(challenge_id);

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

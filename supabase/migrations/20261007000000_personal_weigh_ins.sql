-- A weigh-in belongs to a user/date; group visibility is a separate explicit
-- relation. This migration depends on #209's share_with_group column/function.
begin;

do $$
begin
  if exists (
    select 1
    from public.weigh_ins as weigh_in
    join public.participants as participant
      on participant.id = weigh_in.participant_id
    group by participant.user_id, weigh_in.recorded_date
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'Personal weigh-in migration stopped: duplicate user/date rows need owner review.';
  end if;
end;
$$;

create table public.personal_weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_weigh_ins_user_date_unique unique (user_id, recorded_date)
);

create index personal_weigh_ins_user_date_desc_idx
  on public.personal_weigh_ins (user_id, recorded_date desc);

create table public.personal_weigh_in_group_shares (
  personal_weigh_in_id uuid not null
    references public.personal_weigh_ins (id) on delete cascade,
  challenge_id uuid not null
    references public.challenges (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (personal_weigh_in_id, challenge_id)
);

create index personal_weigh_in_group_shares_challenge_idx
  on public.personal_weigh_in_group_shares (challenge_id, personal_weigh_in_id);

-- Retain an exact, reversible provenance link while legacy consumers are
-- migrated. Deleting a personal entry keeps the source legacy row and mapping.
create table public.personal_weigh_in_legacy_map (
  legacy_weigh_in_id uuid primary key
    references public.weigh_ins (id) on delete cascade,
  personal_weigh_in_id uuid
    references public.personal_weigh_ins (id) on delete set null,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  legacy_share_with_group boolean not null,
  migrated_at timestamptz not null default now()
);

alter table public.personal_weigh_ins enable row level security;
alter table public.personal_weigh_in_group_shares enable row level security;
alter table public.personal_weigh_in_legacy_map enable row level security;

create policy personal_weigh_ins_select_own
  on public.personal_weigh_ins for select to authenticated
  using (user_id = (select auth.uid()));

-- Hosted executors may inherit permissive table defaults. RLS does not guard
-- every privilege (for example TRUNCATE), so reset client ACLs explicitly.
-- UUID keys use gen_random_uuid(); these three tables create no sequences.
revoke all on public.personal_weigh_ins, public.personal_weigh_in_group_shares,
  public.personal_weigh_in_legacy_map from public, anon, authenticated;
grant select on public.personal_weigh_ins to authenticated;

-- This guard above must pass before any row is copied. With one source row per
-- user/date, every legacy note and row can be preserved exactly. Existing
-- explicit sharing is translated only to that source challenge.
insert into public.personal_weigh_ins (
  user_id, recorded_date, weight_kg, note, created_at, updated_at
)
select participant.user_id, weigh_in.recorded_date, weigh_in.weight_kg,
  weigh_in.note, weigh_in.created_at, weigh_in.updated_at
from public.weigh_ins as weigh_in
join public.participants as participant
  on participant.id = weigh_in.participant_id;

insert into public.personal_weigh_in_legacy_map (
  legacy_weigh_in_id, personal_weigh_in_id, challenge_id,
  legacy_share_with_group
)
select weigh_in.id, personal.id, participant.challenge_id,
  weigh_in.share_with_group
from public.weigh_ins as weigh_in
join public.participants as participant
  on participant.id = weigh_in.participant_id
join public.personal_weigh_ins as personal
  on personal.user_id = participant.user_id
 and personal.recorded_date = weigh_in.recorded_date;

insert into public.personal_weigh_in_group_shares (
  personal_weigh_in_id, challenge_id
)
select mapping.personal_weigh_in_id, mapping.challenge_id
from public.personal_weigh_in_legacy_map as mapping
join public.challenges as challenge on challenge.id = mapping.challenge_id
where mapping.legacy_share_with_group
  and mapping.personal_weigh_in_id is not null
  and challenge.challenge_kind is distinct from 'personal';

create or replace function public.list_my_personal_weigh_ins()
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
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select personal.id, personal.user_id, personal.recorded_date,
    personal.weight_kg, personal.note, personal.created_at, personal.updated_at,
    coalesce(array_agg(share.challenge_id order by share.challenge_id)
      filter (where share.challenge_id is not null), '{}'::uuid[])
  from public.personal_weigh_ins as personal
  left join public.personal_weigh_in_group_shares as share
    on share.personal_weigh_in_id = personal.id
  where personal.user_id = auth.uid()
  group by personal.id
  order by personal.recorded_date desc;
$$;

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
    and challenge.status = 'active'
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

create or replace function public.delete_personal_weigh_in(
  target_weigh_in_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  deleted_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  delete from public.personal_weigh_ins as personal
  where personal.id = target_weigh_in_id and personal.user_id = actor_id
  returning personal.id into deleted_id;
  return deleted_id is not null;
end;
$$;

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
  with shared_history as (
    select coalesce(participant.display_name, profile.display_name) as display_name,
      personal.user_id,
      personal.recorded_date,
      personal.weight_kg,
      lag(personal.weight_kg) over (
        partition by personal.user_id order by personal.recorded_date
      ) as previous_shared_weight
    from public.personal_weigh_in_group_shares as share
    join public.personal_weigh_ins as personal
      on personal.id = share.personal_weigh_in_id
    join public.profiles as profile on profile.id = personal.user_id
    left join public.participants as participant
      on participant.challenge_id = share.challenge_id
     and participant.user_id = personal.user_id
    join public.challenges as challenge
      on challenge.id = share.challenge_id
    where share.challenge_id = target_challenge_id
      and personal.recorded_date <= current_date
      and (
        challenge.owner_id = personal.user_id
        or exists (
          select 1 from public.participants as author
          where author.challenge_id = challenge.id
            and author.user_id = personal.user_id
            and author.status = 'active'
        )
      )
  )
  select history.display_name, history.recorded_date, history.weight_kg,
    history.weight_kg - history.previous_shared_weight
  from shared_history as history
  order by history.recorded_date desc, history.display_name;
end;
$$;

-- Group aggregates consume only entries explicitly shared to this challenge.
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

-- The owner dashboard receives counts only. Group counts include only
-- challenge-specific shares; personal counts derive from the owner's history.
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
set search_path = pg_catalog, public, auth
as $$
  select challenge.id,
    count(distinct participant.id) filter (where participant.status = 'active'),
    count(distinct participant.id) filter (where personal.id is not null),
    count(personal.id),
    max(personal.recorded_date)
  from public.challenges as challenge
  left join public.participants as participant
    on participant.challenge_id = challenge.id
   and participant.status = 'active'
  left join public.personal_weigh_ins as personal
    on personal.user_id = participant.user_id
   and personal.recorded_date <= current_date
   and (
     (challenge.challenge_kind = 'personal' and participant.user_id = challenge.owner_id)
     or (challenge.challenge_kind is distinct from 'personal' and exists (
       select 1 from public.personal_weigh_in_group_shares as share
       where share.personal_weigh_in_id = personal.id
         and share.challenge_id = challenge.id
     ))
   )
  where challenge.id = target_challenge_id
    and challenge.owner_id = auth.uid()
  group by challenge.id;
$$;

revoke all on function public.list_my_personal_weigh_ins() from public, anon;
revoke all on function public.save_personal_weigh_in(uuid, date, numeric, text, uuid[])
  from public, anon;
revoke all on function public.delete_personal_weigh_in(uuid) from public, anon;
revoke all on function public.get_group_weigh_in_history(uuid) from public, anon;
grant execute on function public.list_my_personal_weigh_ins() to authenticated;
grant execute on function public.save_personal_weigh_in(uuid, date, numeric, text, uuid[])
  to authenticated;
grant execute on function public.delete_personal_weigh_in(uuid) to authenticated;
grant execute on function public.get_group_weigh_in_history(uuid) to authenticated;
revoke all on function public.get_group_progress_summary(uuid, date)
  from public, anon;
revoke all on function public.get_provisional_group_leader_summary(uuid, date)
  from public, anon;
grant execute on function public.get_group_progress_summary(uuid, date)
  to authenticated;
grant execute on function public.get_provisional_group_leader_summary(uuid, date)
  to authenticated;
revoke all on function public.get_challenge_progress_summary(uuid) from public, anon;
grant execute on function public.get_challenge_progress_summary(uuid) to authenticated;

commit;

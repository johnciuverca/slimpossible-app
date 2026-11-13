-- Store private actual-Sunday candidates for provisional views and locked awards.
begin;

create table public.group_weekly_result_control (
  singleton boolean primary key default true check (singleton),
  effective_from_sunday date,
  check (effective_from_sunday is null or extract(dow from effective_from_sunday) = 0)
);

create table public.group_weekly_candidate_weeks (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  sunday date not null check (extract(dow from sunday) = 0),
  snapshot_ready boolean not null default false,
  accepted_xid xid8,
  accepted_at timestamptz,
  primary key (challenge_id, sunday)
);

create table public.group_weekly_candidates (
  challenge_id uuid not null,
  sunday date not null,
  user_id uuid not null,
  participant_id uuid not null,
  joined_at timestamptz,
  display_name text not null,
  is_active boolean not null,
  actual_weight_kg numeric(6, 2),
  primary key (challenge_id, sunday, user_id),
  foreign key (challenge_id, sunday)
    references public.group_weekly_candidate_weeks(challenge_id, sunday) on delete cascade
);

create index group_weekly_candidates_user_sunday_idx
  on public.group_weekly_candidates(challenge_id, user_id, sunday);

create table public.group_weekly_results (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  sunday date not null check (extract(dow from sunday) = 0),
  finalized_at timestamptz not null,
  result_outcome text not null check (result_outcome in (
    'no_eligible_candidates', 'sole_participant', 'sole_eligible',
    'winner', 'shared_winners'
  )),
  active_participant_count integer not null check (active_participant_count >= 0),
  recorded_participant_count integer not null check (recorded_participant_count >= 0),
  eligible_participant_count integer not null check (eligible_participant_count >= 0),
  winner_count integer not null check (winner_count >= 0),
  sole_participant_name text,
  primary key (challenge_id, sunday),
  check (recorded_participant_count <= active_participant_count),
  check ((result_outcome in ('winner', 'shared_winners')) = (winner_count > 0))
);

create table public.group_weekly_result_winners (
  challenge_id uuid not null,
  sunday date not null,
  user_id uuid not null,
  participant_id uuid not null,
  member_key text not null check (member_key ~ '^[0-9a-f]{32}$'),
  display_name text not null,
  weight_change_kg numeric(8, 3) not null,
  previous_weight_kg numeric(6, 2) not null,
  current_weight_kg numeric(6, 2) not null,
  primary key (challenge_id, sunday, user_id),
  foreign key (challenge_id, sunday)
    references public.group_weekly_results(challenge_id, sunday) on delete cascade
);

alter table public.group_weekly_result_control enable row level security;
alter table public.group_weekly_candidate_weeks enable row level security;
alter table public.group_weekly_candidates enable row level security;
alter table public.group_weekly_results enable row level security;
alter table public.group_weekly_result_winners enable row level security;
revoke all on public.group_weekly_result_control,
  public.group_weekly_candidate_weeks,
  public.group_weekly_candidates,
  public.group_weekly_results,
  public.group_weekly_result_winners from public, anon, authenticated, service_role;

create function public.group_weekly_cutoff(target_sunday date)
returns timestamptz language sql immutable strict
set search_path = pg_catalog
as $$
  select (target_sunday::timestamp + time '20:00') at time zone 'Europe/Bucharest'
$$;

create function public.group_weekly_gate_accepts(
  target_sunday date,
  accepted_at timestamptz
)
returns boolean language sql immutable strict
set search_path = pg_catalog, public
as $$
  select extract(dow from target_sunday) = 0
    and accepted_at < public.group_weekly_cutoff(target_sunday)
$$;

revoke all on function public.group_weekly_cutoff(date),
  public.group_weekly_gate_accepts(date, timestamptz) from public, anon, authenticated;

create function public._group_weekly_lock_key(target_challenge_id uuid, target_sunday date)
returns bigint language sql immutable strict
set search_path = pg_catalog
as $$
  select hashtextextended(target_challenge_id::text || ':' || target_sunday::text, 404404)
$$;
revoke all on function public._group_weekly_lock_key(uuid, date)
  from public, anon, authenticated;

create function public._group_weekly_lock_scopes(target_scopes jsonb)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  scope record;
  transaction_id xid8 := pg_catalog.pg_current_xact_id();
  accepted_at timestamptz;
  effective_sunday date;
  prior_xid xid8;
begin
  for scope in
    select distinct item.challenge_id, item.sunday,
      public._group_weekly_lock_key(item.challenge_id, item.sunday) as lock_key
    from jsonb_to_recordset(coalesce(target_scopes, '[]'::jsonb)) as item(
      challenge_id uuid, sunday date
    )
    where item.challenge_id is not null
      and item.sunday is not null
      and extract(dow from item.sunday) = 0
    order by lock_key, item.challenge_id, item.sunday
  loop
    perform pg_catalog.pg_advisory_xact_lock(scope.lock_key);
    select control.effective_from_sunday into effective_sunday
    from public.group_weekly_result_control as control where control.singleton;
    if effective_sunday is null or scope.sunday < effective_sunday
       or exists (
         select 1 from public.group_weekly_results as result
         where result.challenge_id = scope.challenge_id and result.sunday = scope.sunday
       ) then
      continue;
    end if;
    select week.accepted_xid into prior_xid
    from public.group_weekly_candidate_weeks as week
    where week.challenge_id = scope.challenge_id and week.sunday = scope.sunday;
    if prior_xid = transaction_id then
      continue;
    end if;
    -- Sample wall-clock time only after acquiring this challenge/week lock.
    accepted_at := pg_catalog.clock_timestamp();
    if public.group_weekly_gate_accepts(scope.sunday, accepted_at) then
      insert into public.group_weekly_candidate_weeks(
        challenge_id, sunday, snapshot_ready, accepted_xid, accepted_at
      ) values (scope.challenge_id, scope.sunday, false, transaction_id, accepted_at)
      on conflict (challenge_id, sunday) do update
        set accepted_xid = excluded.accepted_xid,
            accepted_at = excluded.accepted_at;
    end if;
  end loop;
end;
$$;
revoke all on function public._group_weekly_lock_scopes(jsonb)
  from public, anon, authenticated, service_role;

create function public._group_weekly_ensure_snapshot(
  target_challenge_id uuid,
  target_sunday date
)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  week public.group_weekly_candidate_weeks%rowtype;
begin
  select candidate_week.* into week
  from public.group_weekly_candidate_weeks as candidate_week
  where candidate_week.challenge_id = target_challenge_id
    and candidate_week.sunday = target_sunday
  for update;
  if not found or week.snapshot_ready then return; end if;

  insert into public.group_weekly_candidates(
    challenge_id, sunday, user_id, participant_id, joined_at, display_name,
    is_active, actual_weight_kg
  )
  select target_challenge_id, target_sunday,
    participant.user_id, participant.id, participant.joined_at, participant.display_name,
    participant.status = 'active',
    case when share.personal_weigh_in_id is not null
      and participant.joined_at is not null
      and personal.recorded_date >= (participant.joined_at at time zone 'Europe/Bucharest')::date
      and greatest(personal.created_at, personal.updated_at) >= participant.joined_at
      then personal.weight_kg end
  from public.participants as participant
  left join public.personal_weigh_ins as personal
    on personal.user_id = participant.user_id
   and personal.recorded_date = target_sunday
  left join public.personal_weigh_in_group_shares as share
    on share.personal_weigh_in_id = personal.id
   and share.challenge_id = target_challenge_id
  where participant.challenge_id = target_challenge_id
  on conflict (challenge_id, sunday, user_id) do update set
    participant_id = excluded.participant_id,
    joined_at = excluded.joined_at,
    display_name = excluded.display_name,
    is_active = excluded.is_active,
    actual_weight_kg = excluded.actual_weight_kg;

  update public.group_weekly_candidate_weeks
  set snapshot_ready = true
  where challenge_id = target_challenge_id and sunday = target_sunday;
end;
$$;
revoke all on function public._group_weekly_ensure_snapshot(uuid, date)
  from public, anon, authenticated, service_role;

create function public._group_weekly_refresh_accepted_scopes()
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  transaction_id xid8 := pg_catalog.pg_current_xact_id();
  scope record;
begin
  for scope in
    select week.challenge_id, week.sunday
    from public.group_weekly_candidate_weeks as week
    where week.accepted_xid = transaction_id
    order by public._group_weekly_lock_key(week.challenge_id, week.sunday)
  loop
    perform public._group_weekly_ensure_snapshot(scope.challenge_id, scope.sunday);
    insert into public.group_weekly_candidates(
      challenge_id, sunday, user_id, participant_id, joined_at, display_name,
      is_active, actual_weight_kg
    )
    select scope.challenge_id, scope.sunday,
      participant.user_id, participant.id, participant.joined_at, participant.display_name,
      participant.status = 'active',
      case when share.personal_weigh_in_id is not null
        and participant.joined_at is not null
        and personal.recorded_date >= (participant.joined_at at time zone 'Europe/Bucharest')::date
        and greatest(personal.created_at, personal.updated_at) >= participant.joined_at
        then personal.weight_kg end
    from public.participants as participant
    left join public.personal_weigh_ins as personal
      on personal.user_id = participant.user_id
     and personal.recorded_date = scope.sunday
    left join public.personal_weigh_in_group_shares as share
      on share.personal_weigh_in_id = personal.id
     and share.challenge_id = scope.challenge_id
    where participant.challenge_id = scope.challenge_id
    on conflict (challenge_id, sunday, user_id) do update set
      participant_id = excluded.participant_id,
      joined_at = excluded.joined_at,
      display_name = excluded.display_name,
      is_active = excluded.is_active,
      actual_weight_kg = excluded.actual_weight_kg;

    delete from public.group_weekly_candidates as candidate
    where candidate.challenge_id = scope.challenge_id
      and candidate.sunday = scope.sunday
      and not exists (
        select 1 from public.participants as participant
        where participant.challenge_id = scope.challenge_id
          and participant.user_id = candidate.user_id
      );
  end loop;
end;
$$;
revoke all on function public._group_weekly_refresh_accepted_scopes()
  from public, anon, authenticated, service_role;

create function public._group_weekly_upcoming_sunday()
returns date language plpgsql stable
set search_path = pg_catalog, public
as $$
declare
  local_date date := (pg_catalog.clock_timestamp() at time zone 'Europe/Bucharest')::date;
  sunday date;
begin
  sunday := date_trunc('week', local_date)::date + 6;
  if local_date = sunday and pg_catalog.clock_timestamp() >= public.group_weekly_cutoff(sunday) then
    sunday := sunday + 7;
  end if;
  return sunday;
end;
$$;
revoke all on function public._group_weekly_upcoming_sunday()
  from public, anon, authenticated, service_role;

create function public._group_weekly_weigh_in_before()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  entry_id uuid;
  source_ids uuid[] := '{}'::uuid[];
  old_sunday date;
  new_sunday date;
  scopes jsonb := '[]'::jsonb;
  scope record;
begin
  if tg_op <> 'INSERT' then
    entry_id := old.id;
    source_ids := array_append(source_ids, old.id);
    old_sunday := old.recorded_date;
  end if;
  if tg_op <> 'DELETE' then
    entry_id := new.id;
    source_ids := array_append(source_ids, new.id);
    new_sunday := new.recorded_date;
  end if;
  if tg_op = 'UPDATE' and old.id is distinct from new.id then
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(least(old.id::text, new.id::text), 404405));
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(greatest(old.id::text, new.id::text), 404405));
  else
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(entry_id::text, 404405));
  end if;

  for scope in
    select distinct share.challenge_id, target.sunday,
      public._group_weekly_lock_key(share.challenge_id, target.sunday) as lock_key
    from public.personal_weigh_in_group_shares as share
    cross join lateral (values (old_sunday), (new_sunday)) as target(sunday)
    where share.personal_weigh_in_id = any(source_ids)
      and target.sunday is not null and extract(dow from target.sunday) = 0
    order by lock_key
  loop
    scopes := scopes || jsonb_build_array(jsonb_build_object(
      'challenge_id', scope.challenge_id, 'sunday', scope.sunday
    ));
  end loop;
  perform public._group_weekly_lock_scopes(scopes);
  for scope in select * from jsonb_to_recordset(scopes) as item(challenge_id uuid, sunday date)
  loop
    perform public._group_weekly_ensure_snapshot(scope.challenge_id, scope.sunday);
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_weigh_in_before() from public;
create trigger personal_weigh_ins_00_group_weekly_candidates
before insert or update or delete on public.personal_weigh_ins
for each row execute function public._group_weekly_weigh_in_before();

create function public._group_weekly_weigh_in_after()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public._group_weekly_refresh_accepted_scopes();
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_weigh_in_after() from public;
create trigger personal_weigh_ins_90_group_weekly_candidates
after insert or update or delete on public.personal_weigh_ins
for each row execute function public._group_weekly_weigh_in_after();

create function public._group_weekly_share_before()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  old_entry public.personal_weigh_ins%rowtype;
  new_entry public.personal_weigh_ins%rowtype;
  scopes jsonb := '[]'::jsonb;
  scope record;
  old_id uuid;
  new_id uuid;
begin
  if tg_op = 'UPDATE' and old.personal_weigh_in_id is distinct from new.personal_weigh_in_id then
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(least(
      old.personal_weigh_in_id::text, new.personal_weigh_in_id::text
    ), 404405));
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(greatest(
      old.personal_weigh_in_id::text, new.personal_weigh_in_id::text
    ), 404405));
  end if;
  if tg_op <> 'INSERT' then
    old_id := old.personal_weigh_in_id;
    select personal.* into old_entry from public.personal_weigh_ins as personal
    where personal.id = old_id for update;
    if found then
      if tg_op <> 'UPDATE' or old.personal_weigh_in_id = new.personal_weigh_in_id then
        perform pg_catalog.pg_advisory_xact_lock(hashtextextended(old_id::text, 404405));
      end if;
      if extract(dow from old_entry.recorded_date) = 0 then
        scopes := scopes || jsonb_build_array(jsonb_build_object(
          'challenge_id', old.challenge_id, 'sunday', old_entry.recorded_date
        ));
      end if;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    new_id := new.personal_weigh_in_id;
    select personal.* into new_entry from public.personal_weigh_ins as personal
    where personal.id = new_id for update;
    if found then
      if tg_op <> 'UPDATE' or old.personal_weigh_in_id = new.personal_weigh_in_id then
        perform pg_catalog.pg_advisory_xact_lock(hashtextextended(new_id::text, 404405));
      end if;
      if extract(dow from new_entry.recorded_date) = 0 then
        scopes := scopes || jsonb_build_array(jsonb_build_object(
          'challenge_id', new.challenge_id, 'sunday', new_entry.recorded_date
        ));
      end if;
    end if;
  end if;
  perform public._group_weekly_lock_scopes(scopes);
  for scope in select * from jsonb_to_recordset(scopes) as item(challenge_id uuid, sunday date)
  loop
    perform public._group_weekly_ensure_snapshot(scope.challenge_id, scope.sunday);
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_share_before() from public;
create trigger personal_weigh_in_shares_00_group_weekly_candidates
before insert or update or delete on public.personal_weigh_in_group_shares
for each row execute function public._group_weekly_share_before();

create function public._group_weekly_share_after()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  perform public._group_weekly_refresh_accepted_scopes();
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_share_after() from public;
create trigger personal_weigh_in_shares_90_group_weekly_candidates
after insert or update or delete on public.personal_weigh_in_group_shares
for each row execute function public._group_weekly_share_after();

create function public._group_weekly_participant_before()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  scopes jsonb := '[]'::jsonb;
  scope record;
  open_sunday date := public._group_weekly_upcoming_sunday();
  effective_sunday date;
begin
  -- Membership writes across groups serialize before taking date-scoped locks.
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended('group-weekly-membership', 404404));
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is not null then
    open_sunday := greatest(open_sunday, effective_sunday);
  end if;
  if tg_op <> 'INSERT' then
    scopes := scopes || jsonb_build_array(jsonb_build_object(
      'challenge_id', old.challenge_id, 'sunday', open_sunday
    ));
    for scope in
      select distinct week.challenge_id, week.sunday
      from public.group_weekly_candidate_weeks as week
      where week.challenge_id = old.challenge_id and week.sunday >= open_sunday
        and not exists (select 1 from public.group_weekly_results as result
          where result.challenge_id = week.challenge_id and result.sunday = week.sunday)
    loop
      scopes := scopes || jsonb_build_array(jsonb_build_object(
      'challenge_id', scope.challenge_id, 'sunday', scope.sunday
      ));
    end loop;
  end if;
  if tg_op <> 'DELETE' then
    scopes := scopes || jsonb_build_array(jsonb_build_object(
      'challenge_id', new.challenge_id, 'sunday', open_sunday
    ));
    for scope in
      select distinct week.challenge_id, week.sunday
      from public.group_weekly_candidate_weeks as week
      where week.challenge_id = new.challenge_id and week.sunday >= open_sunday
        and not exists (select 1 from public.group_weekly_results as result
          where result.challenge_id = week.challenge_id and result.sunday = week.sunday)
    loop
      scopes := scopes || jsonb_build_array(jsonb_build_object(
        'challenge_id', scope.challenge_id, 'sunday', scope.sunday
      ));
    end loop;
  end if;
  perform public._group_weekly_lock_scopes(scopes);
  for scope in select * from jsonb_to_recordset(scopes) as item(challenge_id uuid, sunday date)
  loop
    perform public._group_weekly_ensure_snapshot(scope.challenge_id, scope.sunday);
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_participant_before() from public;
create trigger participants_00_group_weekly_candidates
before insert or update or delete on public.participants
for each row execute function public._group_weekly_participant_before();

create function public._group_weekly_participant_after()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  open_sunday date := public._group_weekly_upcoming_sunday();
  effective_sunday date;
begin
  perform public._group_weekly_refresh_accepted_scopes();
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is not null then
    open_sunday := greatest(open_sunday, effective_sunday);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and
      (old.challenge_id, old.user_id) is distinct from (new.challenge_id, new.user_id)) then
    delete from public.group_weekly_candidates as candidate
    where candidate.challenge_id = old.challenge_id and candidate.user_id = old.user_id
      and candidate.sunday >= open_sunday
      and not exists (select 1 from public.group_weekly_results as result
        where result.challenge_id = candidate.challenge_id and result.sunday = candidate.sunday);
  end if;
  if tg_op <> 'DELETE' then
    insert into public.group_weekly_candidates(
      challenge_id, sunday, user_id, participant_id, joined_at, display_name,
      is_active, actual_weight_kg
    )
    select participant.challenge_id, week.sunday, participant.user_id,
      participant.id, participant.joined_at, participant.display_name,
      participant.status = 'active',
      case when share.personal_weigh_in_id is not null
        and participant.joined_at is not null
        and personal.recorded_date >= (participant.joined_at at time zone 'Europe/Bucharest')::date
        and greatest(personal.created_at, personal.updated_at) >= participant.joined_at
        then personal.weight_kg end
    from public.participants as participant
    join public.group_weekly_candidate_weeks as week
      on week.challenge_id = participant.challenge_id and week.sunday >= open_sunday
    left join public.personal_weigh_ins as personal
      on personal.user_id = participant.user_id and personal.recorded_date = week.sunday
    left join public.personal_weigh_in_group_shares as share
      on share.personal_weigh_in_id = personal.id
     and share.challenge_id = participant.challenge_id
    where (participant.challenge_id = new.challenge_id and participant.user_id = new.user_id)
      and not exists (select 1 from public.group_weekly_results as result
        where result.challenge_id = week.challenge_id and result.sunday = week.sunday)
    on conflict (challenge_id, sunday, user_id) do update set
      participant_id = excluded.participant_id,
      joined_at = excluded.joined_at,
      display_name = excluded.display_name,
      is_active = excluded.is_active,
      actual_weight_kg = excluded.actual_weight_kg;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public._group_weekly_participant_after() from public;
create trigger participants_90_group_weekly_candidates
after insert or update or delete on public.participants
for each row execute function public._group_weekly_participant_after();

create function public.group_weekly_rollout_cutoff_is_future(
  target_sunday date, check_at timestamptz default pg_catalog.clock_timestamp()
)
returns boolean language sql immutable
set search_path = pg_catalog, public
as $$
  select extract(dow from target_sunday) = 0
    and public.group_weekly_cutoff(target_sunday) > check_at
$$;
revoke all on function public.group_weekly_rollout_cutoff_is_future(date, timestamptz)
  from public, anon, authenticated;

create function public.initialize_group_weekly_results(target_effective_from_sunday date)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  prior_sunday date;
  target_challenge_id uuid;
  target_sunday date;
  challenge_end_sunday date;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  if not public.group_weekly_rollout_cutoff_is_future(target_effective_from_sunday) then
    raise exception using errcode = '22023', message = 'Choose a Sunday whose 20:00 Bucharest cutoff is still ahead.';
  end if;
  -- Stop source, share, challenge, and participant writes while the initial
  -- per-challenge Sunday snapshots and eligibility baseline are captured.
  lock table public.personal_weigh_ins in share row exclusive mode;
  lock table public.personal_weigh_in_group_shares in share row exclusive mode;
  lock table public.challenges in share row exclusive mode;
  lock table public.participants in share row exclusive mode;
  if exists (select 1 from public.group_weekly_result_control) then
    raise exception using errcode = '23505', message = 'Weekly results are already initialized.';
  end if;
  insert into public.group_weekly_result_control(singleton, effective_from_sunday)
  values (true, target_effective_from_sunday);
  prior_sunday := target_effective_from_sunday - 7;
  for target_challenge_id in
    select challenge.id from public.challenges as challenge
    where challenge.challenge_kind is distinct from 'personal'
      and challenge.end_date >= target_effective_from_sunday
    order by challenge.id
  loop
    select challenge.end_date - extract(dow from challenge.end_date)::integer
      into challenge_end_sunday
    from public.challenges as challenge where challenge.id = target_challenge_id;
    for target_sunday in
      select prior_sunday
      union
      select generate_series(
        target_effective_from_sunday, challenge_end_sunday, interval '7 days'
      )::date
    loop
      insert into public.group_weekly_candidate_weeks(
        challenge_id, sunday, snapshot_ready
      ) values (target_challenge_id, target_sunday, false)
      on conflict do nothing;
      perform public._group_weekly_ensure_snapshot(target_challenge_id, target_sunday);
    end loop;
  end loop;
end;
$$;
revoke all on function public.initialize_group_weekly_results(date)
  from public, anon, authenticated;
grant execute on function public.initialize_group_weekly_results(date) to service_role;

create function public._group_weekly_seed_new_challenge()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  effective_sunday date;
  first_sunday date;
  final_sunday date;
  target_sunday date;
begin
  if new.challenge_kind = 'personal' then return new; end if;
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is null then return new; end if;
  first_sunday := greatest(effective_sunday, public._group_weekly_upcoming_sunday());
  final_sunday := new.end_date - extract(dow from new.end_date)::integer;
  if first_sunday > final_sunday then return new; end if;
  insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
  values (new.id, first_sunday - 7) on conflict do nothing;
  perform public._group_weekly_ensure_snapshot(new.id, first_sunday - 7);
  for target_sunday in
    select generate_series(first_sunday, final_sunday, interval '7 days')::date
  loop
    insert into public.group_weekly_candidate_weeks(challenge_id, sunday)
    values (new.id, target_sunday) on conflict do nothing;
    perform public._group_weekly_ensure_snapshot(new.id, target_sunday);
  end loop;
  return new;
end;
$$;
revoke all on function public._group_weekly_seed_new_challenge() from public;
create trigger challenges_seed_group_weekly_candidates
after insert or update of end_date on public.challenges
for each row execute function public._group_weekly_seed_new_challenge();

create function public._group_weekly_snapshot_summary(
  target_challenge_id uuid,
  target_sunday date
)
returns table (
  active_count integer,
  recorded_count integer,
  eligible_count integer,
  outcome text,
  sole_name text,
  winner_count integer,
  winner_names text[],
  winner_details jsonb
)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with current_rows as (
    select candidate.* from public.group_weekly_candidates as candidate
    where candidate.challenge_id = target_challenge_id
      and candidate.sunday = target_sunday
  ), previous_rows as (
    select candidate.* from public.group_weekly_candidates as candidate
    where candidate.challenge_id = target_challenge_id
      and candidate.sunday = target_sunday - 7
  ), eligible as (
    select current_row.user_id, current_row.display_name,
      current_row.actual_weight_kg - previous_row.actual_weight_kg as loss_change,
      previous_row.actual_weight_kg as previous_weight,
      current_row.actual_weight_kg as current_weight
    from current_rows as current_row
    join previous_rows as previous_row
      on previous_row.user_id = current_row.user_id
     and previous_row.joined_at is not distinct from current_row.joined_at
    where current_row.is_active
      and current_row.actual_weight_kg is not null
      and previous_row.actual_weight_kg is not null
  ), summary as (
    select (select count(*)::integer from current_rows where is_active) as active_count,
      (select count(*)::integer from current_rows
        where is_active and actual_weight_kg is not null) as recorded_count,
      (select count(*)::integer from eligible) as eligible_count,
      (select min(loss_change) from eligible) as best_change
  ), winners as (
    select eligible.* from eligible cross join summary
    where summary.eligible_count > 1 and eligible.loss_change = summary.best_change
  ), winner_display as (
    select count(*)::integer as winner_count,
      coalesce(array_agg(winner.display_name order by winner.display_name, winner.user_id), '{}') as names,
      coalesce(jsonb_agg(jsonb_build_object(
        'member_key', md5(target_challenge_id::text || ':' || winner.user_id::text),
        'display_name', winner.display_name
      ) order by winner.display_name, winner.user_id), '[]'::jsonb) as details
    from winners as winner
  )
  select summary.active_count, summary.recorded_count, summary.eligible_count,
    case
      when summary.eligible_count = 0 then 'no_eligible_candidates'
      when summary.eligible_count = 1 and summary.active_count = 1 then 'sole_participant'
      when summary.eligible_count = 1 then 'sole_eligible'
      when winner_display.winner_count = 1 then 'winner'
      else 'shared_winners'
    end,
    case when summary.eligible_count = 1 then (
      select eligible.display_name from eligible limit 1
    ) else null end,
    winner_display.winner_count, winner_display.names, winner_display.details
  from summary cross join winner_display
$$;
revoke all on function public._group_weekly_snapshot_summary(uuid, date)
  from public, anon, authenticated, service_role;

create function public._finalize_group_weekly_result_locked(
  target_challenge_id uuid,
  target_sunday date
)
returns boolean language plpgsql volatile security definer
set search_path = pg_catalog, public
as $$
declare
  now_at timestamptz;
  effective_sunday date;
  summary record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._group_weekly_lock_key(target_challenge_id, target_sunday)
  );
  now_at := pg_catalog.clock_timestamp();
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is null or target_sunday < effective_sunday
     or now_at < public.group_weekly_cutoff(target_sunday) then
    return false;
  end if;
  if not exists (select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id and challenge.end_date >= target_sunday) then
    return false;
  end if;
  if exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = target_challenge_id and result.sunday = target_sunday) then
    return false;
  end if;
  if not exists (select 1 from public.group_weekly_candidate_weeks as week
    where week.challenge_id = target_challenge_id and week.sunday = target_sunday
      and week.snapshot_ready) then
    return false;
  end if;
  if not exists (select 1 from public.group_weekly_candidate_weeks as week
    where week.challenge_id = target_challenge_id and week.sunday = target_sunday - 7
      and week.snapshot_ready) then
    return false;
  end if;
  select * into summary from public._group_weekly_snapshot_summary(
    target_challenge_id, target_sunday
  );
  insert into public.group_weekly_results(
    challenge_id, sunday, finalized_at, result_outcome,
    active_participant_count, recorded_participant_count,
    eligible_participant_count, winner_count, sole_participant_name
  ) values (
    target_challenge_id, target_sunday, now_at, summary.outcome,
    summary.active_count, summary.recorded_count,
    summary.eligible_count, summary.winner_count, summary.sole_name
  ) on conflict do nothing;
  insert into public.group_weekly_result_winners(
    challenge_id, sunday, user_id, participant_id, member_key, display_name,
    weight_change_kg, previous_weight_kg, current_weight_kg
  )
  select target_challenge_id, target_sunday, winner.user_id, winner.participant_id,
    md5(target_challenge_id::text || ':' || winner.user_id::text),
    winner.display_name, current_row.actual_weight_kg - previous_row.actual_weight_kg,
    previous_row.actual_weight_kg, current_row.actual_weight_kg
  from public.group_weekly_candidates as current_row
  join public.group_weekly_candidates as previous_row
    on previous_row.challenge_id = current_row.challenge_id
   and previous_row.user_id = current_row.user_id
   and previous_row.joined_at is not distinct from current_row.joined_at
   and previous_row.sunday = target_sunday - 7
  join public.group_weekly_candidates as winner
    on winner.challenge_id = current_row.challenge_id
   and winner.user_id = current_row.user_id and winner.sunday = target_sunday
  where current_row.challenge_id = target_challenge_id
    and current_row.sunday = target_sunday
    and winner.is_active
    and current_row.actual_weight_kg is not null
    and previous_row.actual_weight_kg is not null
    and summary.eligible_count > 1
    and current_row.actual_weight_kg - previous_row.actual_weight_kg = (
      select min(best.actual_weight_kg - prior.actual_weight_kg)
      from public.group_weekly_candidates as best
      join public.group_weekly_candidates as prior
        on prior.challenge_id = best.challenge_id
       and prior.user_id = best.user_id and prior.sunday = target_sunday - 7
       and prior.joined_at is not distinct from best.joined_at
      where best.challenge_id = target_challenge_id and best.sunday = target_sunday
        and best.is_active and best.actual_weight_kg is not null
        and prior.actual_weight_kg is not null
    )
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function public._finalize_group_weekly_result_locked(uuid, date)
  from public, anon, authenticated, service_role;

create function public._finalize_group_weekly_results_through(
  target_challenge_id uuid,
  target_sunday date
)
returns boolean language plpgsql volatile security definer
set search_path = pg_catalog, public
as $$
declare
  effective_sunday date;
  first_award_sunday date;
  week_sunday date;
  lock_scope record;
begin
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is null or target_sunday < effective_sunday then return false; end if;
  select min(current_week.sunday) into first_award_sunday
  from public.group_weekly_candidate_weeks as current_week
  join public.group_weekly_candidate_weeks as previous_week
    on previous_week.challenge_id = current_week.challenge_id
   and previous_week.sunday = current_week.sunday - 7
  where current_week.challenge_id = target_challenge_id
    and current_week.sunday >= effective_sunday
    and current_week.sunday <= target_sunday;
  if first_award_sunday is null then
    return not exists (select 1 from public.group_weekly_candidate_weeks as current_week
      where current_week.challenge_id = target_challenge_id
        and current_week.sunday = target_sunday
        and (not current_week.snapshot_ready or not exists (
          select 1 from public.group_weekly_candidate_weeks as previous_week
          where previous_week.challenge_id = current_week.challenge_id
            and previous_week.sunday = current_week.sunday - 7
            and previous_week.snapshot_ready
        )));
  end if;
  -- Reserve every due scope in the same lock-key order used by write triggers,
  -- then finalize in calendar order while holding the complete due range.
  for lock_scope in
    select dates.sunday,
      public._group_weekly_lock_key(target_challenge_id, dates.sunday::date) as lock_key
    from generate_series(first_award_sunday, target_sunday, interval '7 days') as dates(sunday)
    where pg_catalog.clock_timestamp() >= public.group_weekly_cutoff(dates.sunday::date)
    order by lock_key, dates.sunday
  loop
    perform pg_catalog.pg_advisory_xact_lock(lock_scope.lock_key);
  end loop;
  week_sunday := first_award_sunday;
  while week_sunday <= target_sunday loop
    if pg_catalog.clock_timestamp() < public.group_weekly_cutoff(week_sunday) then
      exit;
    end if;
    if not exists (select 1 from public.group_weekly_candidate_weeks as week
      where week.challenge_id = target_challenge_id and week.sunday = week_sunday) then
      return false;
    end if;
    if not exists (select 1 from public.group_weekly_candidate_weeks as week
      where week.challenge_id = target_challenge_id and week.sunday = week_sunday
        and week.snapshot_ready) then
      return false;
    end if;
    if not public._finalize_group_weekly_result_locked(target_challenge_id, week_sunday)
       and not exists (select 1 from public.group_weekly_results as result
         where result.challenge_id = target_challenge_id and result.sunday = week_sunday) then
      return false;
    end if;
    week_sunday := week_sunday + 7;
  end loop;
  return true;
end;
$$;
revoke all on function public._finalize_group_weekly_results_through(uuid, date)
  from public, anon, authenticated, service_role;

create function public.get_group_weekly_result_display(
  target_challenge_id uuid,
  target_sunday date
)
returns table (
  active_participant_count integer,
  recorded_participant_count integer,
  eligible_participant_count integer,
  finalized_at timestamptz,
  result_state text,
  result_outcome text,
  sole_participant_name text,
  winner_count integer,
  winner_details jsonb,
  winner_names text[]
)
language plpgsql volatile security definer
set search_path = pg_catalog, public, auth
as $$
declare
  effective_sunday date;
  summary record;
  now_at timestamptz;
  challenge_start_date date;
  challenge_end_date date;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_sunday is null or extract(dow from target_sunday) <> 0 then
    raise exception using errcode = '22023', message = 'A Sunday is required.';
  end if;
  if not exists (
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as participant
        where participant.challenge_id = challenge.id
          and participant.user_id = auth.uid() and participant.status = 'active'
      ))
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  select challenge.start_date, challenge.end_date
    into challenge_start_date, challenge_end_date
  from public.challenges as challenge where challenge.id = target_challenge_id;
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is null then
    return query select 0, 0, 0, null::timestamptz, 'disabled',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  if target_sunday < effective_sunday then
    return query select 0, 0, 0, null::timestamptz, 'not_available',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  if target_sunday > challenge_end_date - extract(dow from challenge_end_date)::integer then
    return query select 0, 0, 0, null::timestamptz, 'not_available',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  if target_sunday < challenge_start_date then
    return query select 0, 0, 0, null::timestamptz, 'not_available',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  now_at := pg_catalog.clock_timestamp();
  if now_at < public.group_weekly_cutoff(target_sunday) then
    perform pg_catalog.pg_advisory_xact_lock(
      public._group_weekly_lock_key(target_challenge_id, target_sunday)
    );
    perform public._group_weekly_ensure_snapshot(target_challenge_id, target_sunday);
    if not exists (select 1 from public.group_weekly_candidate_weeks as week
      where week.challenge_id = target_challenge_id and week.sunday = target_sunday
        and week.snapshot_ready) then
      return query select 0, 0, 0, null::timestamptz, 'pending',
        'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
      return;
    end if;
    if not exists (select 1 from public.group_weekly_candidate_weeks as week
      where week.challenge_id = target_challenge_id and week.sunday = target_sunday - 7
        and week.snapshot_ready) then
      return query select 0, 0, 0, null::timestamptz, 'pending',
        'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
      return;
    end if;
    select * into summary from public._group_weekly_snapshot_summary(
      target_challenge_id, target_sunday
    );
    return query select summary.active_count, summary.recorded_count,
      summary.eligible_count, null::timestamptz, 'provisional', summary.outcome,
      summary.sole_name, summary.winner_count, summary.winner_details, summary.winner_names;
    return;
  end if;
  if not public._finalize_group_weekly_results_through(target_challenge_id, target_sunday) then
    return query select 0, 0, 0, null::timestamptz, 'pending',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  if not exists (select 1 from public.group_weekly_results as result
    where result.challenge_id = target_challenge_id and result.sunday = target_sunday) then
    return query select 0, 0, 0, null::timestamptz, 'pending',
      'no_eligible_candidates', null::text, 0, '[]'::jsonb, '{}'::text[];
    return;
  end if;
  return query select result.active_participant_count,
    result.recorded_participant_count, result.eligible_participant_count,
    result.finalized_at, 'finalized', result.result_outcome,
    result.sole_participant_name, result.winner_count,
    coalesce((select jsonb_agg(jsonb_build_object(
      'member_key', winner.member_key, 'display_name', winner.display_name
    ) order by winner.display_name, winner.member_key)
      from public.group_weekly_result_winners as winner
      where winner.challenge_id = result.challenge_id and winner.sunday = result.sunday), '[]'::jsonb),
    coalesce((select array_agg(winner.display_name order by winner.display_name, winner.member_key)
      from public.group_weekly_result_winners as winner
      where winner.challenge_id = result.challenge_id and winner.sunday = result.sunday), '{}'::text[])
  from public.group_weekly_results as result
  where result.challenge_id = target_challenge_id and result.sunday = target_sunday;
end;
$$;
revoke all on function public.get_group_weekly_result_display(uuid, date)
  from public, anon;
grant execute on function public.get_group_weekly_result_display(uuid, date)
  to authenticated;

drop function public.get_provisional_group_leader_summary(uuid, date);
create function public.get_provisional_group_leader_summary(
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
language plpgsql volatile security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_sunday date;
  bucharest_today date := (pg_catalog.clock_timestamp() at time zone 'Europe/Bucharest')::date;
  result_row record;
  active_count bigint;
  eligible_count bigint;
  legacy_winner_count bigint;
  legacy_names text[];
begin
  if auth.uid() is null or not exists (
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as member
        where member.challenge_id = challenge.id and member.user_id = auth.uid()
          and member.status = 'active'
      ))
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  if target_current_date is null or target_current_date > bucharest_today then
    raise exception using errcode = '22023', message = 'A current or past Bucharest date is required.';
  end if;
  target_sunday := bucharest_today - extract(dow from bucharest_today)::integer;
  select * into result_row from public.get_group_weekly_result_display(
    target_challenge_id, target_sunday
  );
  if result_row.result_state in ('disabled', 'not_available') then
    select count(*) into active_count from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active';
    select count(*), count(*) filter (where result.is_winner),
      coalesce(array_agg(result.display_name order by result.display_name)
        filter (where result.is_winner), '{}'::text[])
      into eligible_count, legacy_winner_count, legacy_names
    from public._get_group_weekly_result(target_challenge_id, target_sunday) as result;
    if active_count <= 1 then legacy_winner_count := 0; legacy_names := '{}'::text[]; end if;
    return query select target_challenge_id, target_sunday - 6, target_sunday,
      target_sunday - 7, active_count, eligible_count, legacy_winner_count,
      legacy_names, array_fill(target_sunday, array[legacy_winner_count::integer]),
      case when active_count <= 1 then 'solo-challenge'
        when legacy_winner_count > 0 then 'leaders' else 'no-eligible-candidates' end;
    return;
  end if;
  return query select target_challenge_id, target_sunday - 6, target_sunday,
    target_sunday - 7, result_row.active_participant_count::bigint,
    result_row.eligible_participant_count::bigint,
    case when result_row.result_outcome = 'sole_participant' then 0::bigint
      else result_row.winner_count::bigint end,
    case when result_row.result_outcome = 'sole_participant' then '{}'::text[]
      else result_row.winner_names end,
    array_fill(target_sunday, array[case when result_row.result_outcome = 'sole_participant'
      then 0 else result_row.winner_count end]),
    case when result_row.result_outcome = 'sole_participant' then 'solo-challenge'
      when result_row.winner_count > 0 then 'leaders' else 'no-eligible-candidates' end;
end;
$$;
revoke all on function public.get_provisional_group_leader_summary(uuid, date)
  from public, anon;
grant execute on function public.get_provisional_group_leader_summary(uuid, date)
  to authenticated;

create function public._get_group_weekly_result_legacy(
  target_challenge_id uuid,
  target_current_sunday date
)
returns table(participant_id uuid, display_name text, is_winner boolean)
language sql stable security definer
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
  ), best as (select min(weight_change) as weight_change from candidates)
  select candidate.id, candidate.display_name,
    candidate.weight_change = best.weight_change
  from candidates as candidate cross join best
$$;
revoke all on function public._get_group_weekly_result_legacy(uuid, date)
  from public, anon, authenticated;

create or replace function public._get_group_weekly_result(
  target_challenge_id uuid,
  target_current_sunday date
)
returns table (participant_id uuid, display_name text, is_winner boolean)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with control as (
    select effective_from_sunday from public.group_weekly_result_control where singleton
  ), provisional as (
    select current_row.user_id, current_row.participant_id, current_row.display_name,
      current_row.actual_weight_kg - previous_row.actual_weight_kg as change_kg
    from public.group_weekly_candidates as current_row
    join public.group_weekly_candidates as previous_row
      on previous_row.challenge_id = current_row.challenge_id
     and previous_row.user_id = current_row.user_id
     and previous_row.sunday = target_current_sunday - 7
    where current_row.challenge_id = target_challenge_id
      and current_row.sunday = target_current_sunday and current_row.is_active
      and current_row.actual_weight_kg is not null
      and previous_row.actual_weight_kg is not null
      and (select effective_from_sunday from control) <= target_current_sunday
  ), ranks as (
    select provisional.*,
      min(provisional.change_kg) over () as best_change,
      count(*) over () as eligible_count
    from provisional
  )
  select rank.participant_id, rank.display_name,
    case when exists (select 1 from public.group_weekly_results as result
      where result.challenge_id = target_challenge_id and result.sunday = target_current_sunday)
      then exists (select 1 from public.group_weekly_result_winners as winner
        where winner.challenge_id = target_challenge_id
          and winner.sunday = target_current_sunday and winner.user_id = rank.user_id)
      else rank.eligible_count > 1 and rank.change_kg = rank.best_change
    end
  from ranks as rank
  where exists (select 1 from control where effective_from_sunday <= target_current_sunday)
  union all
  select legacy.participant_id, legacy.display_name, legacy.is_winner
  from public._get_group_weekly_result_legacy(target_challenge_id, target_current_sunday) as legacy
  where not exists (select 1 from control where effective_from_sunday <= target_current_sunday);
$$;
revoke all on function public._get_group_weekly_result(uuid, date)
  from public, anon, authenticated;

-- Keep the existing RPC result shape. Weekly winners come from the snapshot
-- after rollout; the rest of the privacy-safe progress summary is unchanged.
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
language plpgsql volatile security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign-in required.'; end if;
  if target_current_sunday is null or extract(dow from target_current_sunday) <> 0
     or target_current_sunday > current_date then
    raise exception using errcode = '22023', message = 'A current or past Sunday is required.';
  end if;
  if not exists (select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as member
        where member.challenge_id = challenge.id and member.user_id = auth.uid()
          and member.status = 'active'
      ))) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  return query
  with active_participants as (
    select participant.id, participant.user_id, participant.display_name,
      participant.starting_weight_kg, participant.target_weight_kg
    from public.participants as participant
    where participant.challenge_id = target_challenge_id and participant.status = 'active'
  ), latest_weigh_ins as (
    select distinct on (participant.id) participant.id, personal.recorded_date, personal.weight_kg
    from active_participants as participant
    join public.personal_weigh_in_group_shares as share on share.challenge_id = target_challenge_id
    join public.personal_weigh_ins as personal on personal.id = share.personal_weigh_in_id
      and personal.user_id = participant.user_id and personal.recorded_date <= current_date
    order by participant.id, personal.recorded_date desc
  ), progress as (
    select participant.id, latest.recorded_date is not null as has_record,
      case
        when latest.recorded_date is null then null
        when participant.target_weight_kg < participant.starting_weight_kg then
          greatest(0::numeric, least(100::numeric,
            ((participant.starting_weight_kg - latest.weight_kg)
              / (participant.starting_weight_kg - participant.target_weight_kg)) * 100))
        when participant.target_weight_kg > participant.starting_weight_kg then
          greatest(0::numeric, least(100::numeric,
            ((latest.weight_kg - participant.starting_weight_kg)
              / (participant.target_weight_kg - participant.starting_weight_kg)) * 100))
        when latest.weight_kg = participant.target_weight_kg then 100::numeric
        else 0::numeric
      end as completion_percentage
    from active_participants as participant
    left join latest_weigh_ins as latest on latest.id = participant.id
  ), weekly as (
    select result.display_name, result.is_winner
    from public._get_group_weekly_result(target_challenge_id, target_current_sunday) as result
  ), weekly_agg as (
    select count(*) filter (where is_winner) as winners,
      coalesce(array_agg(display_name order by display_name)
        filter (where is_winner), '{}'::text[]) as names
    from weekly
  ), progress_agg as (
    select count(*) as active_count,
      count(*) filter (where has_record) as recorded_count,
      count(*) filter (where completion_percentage is not null) as progress_count,
      round(avg(completion_percentage), 1) as average_completion,
      count(*) filter (where completion_percentage = 100) as reached_count
    from progress
  )
  select target_challenge_id, target_current_sunday, target_current_sunday - 7,
    progress_agg.active_count, progress_agg.recorded_count, progress_agg.progress_count,
    progress_agg.average_completion, progress_agg.reached_count,
    (select count(*) from weekly), weekly_agg.winners, weekly_agg.names
  from progress_agg cross join weekly_agg;
end;
$$;

create or replace function public.get_group_weekly_win_counts(target_challenge_id uuid)
returns table(member_key text, display_name text, win_count bigint)
language plpgsql volatile security definer
set search_path = pg_catalog, public, auth
as $$
declare
  effective_sunday date;
  last_due_sunday date;
  challenge_end_sunday date;
begin
  if auth.uid() is null or not exists (
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as member
        where member.challenge_id = challenge.id and member.user_id = auth.uid()
          and member.status = 'active'
      ))) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;
  select control.effective_from_sunday into effective_sunday
  from public.group_weekly_result_control as control where control.singleton;
  if effective_sunday is not null then
    select challenge.end_date - extract(dow from challenge.end_date)::integer
      into challenge_end_sunday
    from public.challenges as challenge where challenge.id = target_challenge_id;
    last_due_sunday := (pg_catalog.clock_timestamp() at time zone 'Europe/Bucharest')::date
      - extract(dow from pg_catalog.clock_timestamp() at time zone 'Europe/Bucharest')::integer;
    if pg_catalog.clock_timestamp() < public.group_weekly_cutoff(last_due_sunday) then
      last_due_sunday := last_due_sunday - 7;
    end if;
    last_due_sunday := least(last_due_sunday, challenge_end_sunday);
    if last_due_sunday >= effective_sunday
       and not public._finalize_group_weekly_results_through(
         target_challenge_id, last_due_sunday
       ) then
      raise exception using errcode = '55000',
        message = 'Weekly results are pending because a required Sunday snapshot is unavailable.';
    end if;
  end if;
  return query
  with active_members as (
    select participant.id, participant.user_id, participant.display_name
    from public.participants as participant
    where participant.challenge_id = target_challenge_id and participant.status = 'active'
  ), legacy_wins as (
    select winner.participant_id, count(distinct sunday.current_sunday) as wins
    from (
      select distinct current_entry.recorded_date as current_sunday
      from public.personal_weigh_ins as current_entry
      join public.personal_weigh_in_group_shares as current_share
        on current_share.personal_weigh_in_id = current_entry.id
       and current_share.challenge_id = target_challenge_id
      where extract(dow from current_entry.recorded_date) = 0
        and current_entry.recorded_date < current_date
        and (effective_sunday is null or current_entry.recorded_date < effective_sunday)
    ) as sunday
    cross join lateral public._get_group_weekly_result(
      target_challenge_id, sunday.current_sunday
    ) as winner
    where winner.is_winner
    group by winner.participant_id
  ), finalized_wins as (
    select participant.id as participant_id, count(*) as wins
    from public.group_weekly_result_winners as winner
    join public.participants as participant
      on participant.challenge_id = winner.challenge_id and participant.user_id = winner.user_id
    where winner.challenge_id = target_challenge_id
      and (effective_sunday is null or winner.sunday >= effective_sunday)
    group by participant.id
  )
  select md5(target_challenge_id::text || ':' || member.user_id::text),
    member.display_name,
    coalesce(legacy.wins, 0) + coalesce(finalized.wins, 0)
  from active_members as member
  left join legacy_wins as legacy on legacy.participant_id = member.id
  left join finalized_wins as finalized on finalized.participant_id = member.id
  order by member.display_name, member.id;
end;
$$;
revoke all on function public.get_group_weekly_win_counts(uuid)
  from public, anon;
grant execute on function public.get_group_weekly_win_counts(uuid) to authenticated;

-- Reserve challenge rows before source-row triggers acquire Sunday locks. This
-- matches membership RPC order and prevents concurrent multi-group saves from
-- taking disjoint share scopes in request-array order.
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
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  saved_id uuid;
  requested_ids uuid[] := coalesce(target_shared_challenge_ids, '{}'::uuid[]);
  requested_count integer;
  eligible_count integer;
  source_scope_id uuid;
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

  if target_weigh_in_id is null then
    select personal.id into source_scope_id
    from public.personal_weigh_ins as personal
    where personal.user_id = actor_id and personal.recorded_date = target_recorded_date;
  else
    source_scope_id := target_weigh_in_id;
    if not exists (select 1 from public.personal_weigh_ins as personal
      where personal.id = target_weigh_in_id and personal.user_id = actor_id) then
      raise exception using errcode = '42501', message = 'Weigh-in ownership required.';
    end if;
  end if;
  if source_scope_id is null then
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(
      actor_id::text || ':' || target_recorded_date::text, 404406
    ));
    select personal.id into source_scope_id
    from public.personal_weigh_ins as personal
    where personal.user_id = actor_id and personal.recorded_date = target_recorded_date;
  else
    -- Serialize this RPC per source independently of the source-row trigger's
    -- 404405 lock, which is necessarily acquired after PostgreSQL row locking.
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(source_scope_id::text, 404406));
  end if;
  if source_scope_id is not null then
    perform challenge.id
    from public.challenges as challenge
    where challenge.id = any(requested_ids)
       or exists (select 1 from public.personal_weigh_in_group_shares as share
         where share.personal_weigh_in_id = source_scope_id
           and share.challenge_id = challenge.id)
    order by challenge.id
    for update of challenge;
  else
    perform challenge.id
    from public.challenges as challenge
    where challenge.id = any(requested_ids)
    order by challenge.id
    for update of challenge;
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
    where current_entry.id = target_weigh_in_id and current_entry.user_id = actor_id
    returning current_entry.id into saved_id;
    if saved_id is null then
      raise exception using errcode = '42501', message = 'Weigh-in ownership required.';
    end if;
  end if;

  perform challenge.id
  from public.challenges as challenge
  where challenge.id = any(requested_ids)
     or exists (select 1 from public.personal_weigh_in_group_shares as share
       where share.personal_weigh_in_id = saved_id and share.challenge_id = challenge.id)
  order by challenge.id
  for update of challenge;

  select count(*) into eligible_count
  from public.challenges as challenge
  where challenge.id = any(requested_ids)
    and challenge.challenge_kind is distinct from 'personal'
    and (
      (challenge.status in ('draft', 'active') and (
        challenge.owner_id = actor_id
        or exists (select 1 from public.participants as participant
          where participant.challenge_id = challenge.id and participant.user_id = actor_id
            and participant.status = 'active')
      ))
      or (challenge.status = 'archived' and exists (
        select 1 from public.personal_weigh_in_group_shares as prior_share
        where prior_share.personal_weigh_in_id = saved_id
          and prior_share.challenge_id = challenge.id
      ))
    );
  if eligible_count <> requested_count then
    raise exception using errcode = '42501', message = 'Group selection is no longer eligible.';
  end if;

  delete from public.personal_weigh_in_group_shares as share
  using public.challenges as challenge
  where share.personal_weigh_in_id = saved_id
    and challenge.id = share.challenge_id and challenge.status <> 'archived';

  insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id)
  select saved_id, selected.challenge_id
  from unnest(requested_ids) as selected(challenge_id)
  join public.challenges as challenge on challenge.id = selected.challenge_id
  where challenge.status in ('draft', 'active')
  order by public._group_weekly_lock_key(selected.challenge_id, target_recorded_date),
    selected.challenge_id
  on conflict do nothing;

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

-- LOCAL disposable PostgreSQL only. Exercises the database-native pgoutput
-- parser, durable persist/ack separation, replay, permissions and fail-closed
-- slot/schema checks. It never connects to hosted Supabase.
insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Weekly owner'),
  ('00000000-0000-4000-8000-000000000002', 'Weekly member')
on conflict (id) do nothing;

insert into public.challenges(
  id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
) values (
  '40400000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Local weekly result consumer', current_date - 30, current_date + 30,
  'active', 'group'
);

insert into public.participants(
  id, challenge_id, user_id, display_name, status,
  starting_weight_kg, target_weight_kg, joined_at
) values
  ('40400000-0000-4000-8000-000000000011',
   '40400000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001',
   'Weekly owner', 'active', 90, 80, now() - interval '20 days'),
  ('40400000-0000-4000-8000-000000000012',
   '40400000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000002',
   'Weekly member', 'active', 90, 80, now() - interval '20 days');

insert into public.personal_weigh_ins(id, user_id, recorded_date, weight_kg, note) values
  ('40400000-0000-4000-8000-000000000021',
   '00000000-0000-4000-8000-000000000001', current_date - 7, 80, 'must not enter evidence'),
  ('40400000-0000-4000-8000-000000000022',
   '00000000-0000-4000-8000-000000000002',
   date_trunc('week', current_date)::date + 6 - 7, 82, 'must not enter evidence');

insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id) values
  ('40400000-0000-4000-8000-000000000021', '40400000-0000-4000-8000-000000000001'),
  ('40400000-0000-4000-8000-000000000022', '40400000-0000-4000-8000-000000000001');

select * from pg_create_logical_replication_slot(
  'slimpossible_group_weekly_results_v1', 'pgoutput'
);

do $$
declare
  future_sunday date := date_trunc('week',
    (clock_timestamp() at time zone 'Europe/Bucharest'))::date + 13;
  provisional_cutoff timestamptz;
begin
  provisional_cutoff := ((future_sunday::timestamp + time '20:00')
    at time zone 'Europe/Bucharest');
  if public.group_weekly_rollout_cutoff_is_future(
    future_sunday, provisional_cutoff
  ) is distinct from false or not public.group_weekly_rollout_cutoff_is_future(
    future_sunday, provisional_cutoff - interval '1 microsecond'
  ) or public.group_weekly_rollout_cutoff_is_future(
    future_sunday, provisional_cutoff + interval '1 microsecond'
  ) is distinct from false then
    raise exception 'Rollout initialization cutoff does not enforce strict boundary semantics.';
  end if;
end;
$$;

set role service_role;
select public.capture_group_weekly_barrier();
do $$
declare
  current_sunday date := date_trunc('week',
    (clock_timestamp() at time zone 'Europe/Bucharest'))::date + 6;
begin
  begin
    perform public.initialize_group_weekly_results(current_sunday - 7);
    raise exception 'Initializer accepted a past rollout Sunday.';
  exception when sqlstate '22023' then null;
  end;
  if ((current_sunday::timestamp + time '20:00')
      at time zone 'Europe/Bucharest') <= clock_timestamp() then
    begin
      perform public.initialize_group_weekly_results(current_sunday);
      raise exception 'Initializer accepted a Sunday at or after its provisional cutoff.';
    exception when sqlstate '22023' then null;
    end;
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (select 1 from public.group_weekly_result_outbox) then
    raise exception 'Source/barrier triggers accumulated data before initialization.';
  end if;
end;
$$;

set role service_role;
select public.initialize_group_weekly_results(
  (date_trunc('week', (clock_timestamp() at time zone 'Europe/Bucharest'))::date + 13)
);
select public.persist_group_weekly_result_events();
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;

do $$
declare event_count integer;
begin
  select count(*) into event_count from public.group_weekly_result_events
  where challenge_id = '40400000-0000-4000-8000-000000000001';
  if event_count <> 4 then
    raise exception 'Expected two membership and two explicitly shared events, got %', event_count;
  end if;
  if exists (
    select 1 from public.group_weekly_result_events
    where payload ? 'note' or payload::text like '%must not enter evidence%'
  ) then raise exception 'Private weigh-in notes leaked into weekly evidence.'; end if;
  if has_table_privilege('authenticated', 'public.group_weekly_result_events', 'select')
     or has_table_privilege('service_role', 'public.group_weekly_result_events', 'select') then
    raise exception 'A client/worker role can read the raw weekly evidence ledger.';
  end if;
  if has_function_privilege('authenticated', 'public.persist_group_weekly_result_events()', 'execute')
     or has_function_privilege('authenticated', 'public.ack_group_weekly_result_events()', 'execute') then
    raise exception 'Authenticated users can control the private weekly consumer.';
  end if;
end;
$$;

delete from public.personal_weigh_in_group_shares
where personal_weigh_in_id = '40400000-0000-4000-8000-000000000021'
  and challenge_id = '40400000-0000-4000-8000-000000000001';
set role service_role;
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;

do $$
begin
  if not exists (
    select 1 from public.group_weekly_result_events as event
    where event.event_kind = 'weigh_in'
      and event.payload ->> 'shared' = 'false'
      and not (event.payload ? 'weight_kg')
  ) then raise exception 'A revoked share retained its private weight value.'; end if;
end;
$$;

-- Moving a shared record invalidates its former date and shares only the new
-- date. Both events are in the same source transaction.
update public.personal_weigh_ins
set recorded_date = current_date - 1
where id = '40400000-0000-4000-8000-000000000022';
set role service_role;
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;

do $$
begin
  if not exists (
    select 1 from public.group_weekly_result_events as event
    where event.user_id = '00000000-0000-4000-8000-000000000002'
      and event.event_kind = 'weigh_in'
      and event.payload ->> 'recorded_date' = (date_trunc('week', current_date)::date + 6 - 7)::text
      and event.payload ->> 'shared' = 'false'
      and not (event.payload ? 'weight_kg')
  ) or not exists (
    select 1 from public.group_weekly_result_events as event
    where event.user_id = '00000000-0000-4000-8000-000000000002'
      and event.event_kind = 'weigh_in'
      and event.payload ->> 'recorded_date' = (current_date - 1)::text
      and event.payload ->> 'shared' = 'true'
      and event.payload ? 'weight_kg'
  ) then raise exception 'A shared weigh-in date update did not revoke the old and share the new date.'; end if;
end;
$$;

insert into public.challenges(
  id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
) values (
  '40400000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Temporary share destination', current_date - 1, current_date + 1, 'active', 'group'
);
update public.personal_weigh_in_group_shares
set challenge_id = '40400000-0000-4000-8000-000000000002'
where personal_weigh_in_id = '40400000-0000-4000-8000-000000000022'
  and challenge_id = '40400000-0000-4000-8000-000000000001';
set role service_role;
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;
update public.personal_weigh_in_group_shares
set challenge_id = '40400000-0000-4000-8000-000000000001'
where personal_weigh_in_id = '40400000-0000-4000-8000-000000000022'
  and challenge_id = '40400000-0000-4000-8000-000000000002';
set role service_role;
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;

do $$
begin
  if not exists (
    select 1 from public.group_weekly_result_events as event
    where event.challenge_id = '40400000-0000-4000-8000-000000000001'
      and event.user_id = '00000000-0000-4000-8000-000000000002'
      and event.payload ->> 'shared' = 'false'
      and not (event.payload ? 'weight_kg')
  ) or not exists (
    select 1 from public.group_weekly_result_events as event
    where event.challenge_id = '40400000-0000-4000-8000-000000000002'
      and event.user_id = '00000000-0000-4000-8000-000000000002'
      and event.payload ->> 'shared' = 'true'
      and event.payload ? 'weight_kg'
  ) then raise exception 'A share challenge update did not tombstone old scope and snapshot new scope.'; end if;
end;
$$;

do $$
declare
  durable_lsn pg_lsn;
  acknowledged_lsn pg_lsn;
  pending_count integer;
begin
  select control.durable_lsn, control.acknowledged_lsn
    into durable_lsn, acknowledged_lsn
  from public.group_weekly_result_control as control where singleton;
  if durable_lsn is distinct from acknowledged_lsn
     or durable_lsn is distinct from (
       select slot.confirmed_flush_lsn from pg_replication_slots as slot
       where slot.slot_name = 'slimpossible_group_weekly_results_v1'
     ) then raise exception 'Initial persist/ack LSNs did not converge.'; end if;
  select count(*) into pending_count
  from pg_logical_slot_peek_binary_changes(
    'slimpossible_group_weekly_results_v1', null, 100,
    'proto_version', '1', 'publication_names', 'group_weekly_result_outbox_pub'
  );
  if pending_count <> 0 then raise exception 'Acknowledged changes remain in the slot.'; end if;
end;
$$;

select public.capture_group_weekly_barrier();
set role service_role;
select public.persist_group_weekly_result_events();
select public.persist_group_weekly_result_events();
select public.ack_group_weekly_result_events();
reset role;

do $$
declare durable_lsn pg_lsn; acknowledged_lsn pg_lsn;
begin
  if not exists (select 1 from public.group_weekly_result_events where event_kind = 'barrier') then
    raise exception 'Barrier event was not durably stored.';
  end if;
  select control.durable_lsn, control.acknowledged_lsn
    into durable_lsn, acknowledged_lsn
  from public.group_weekly_result_control as control where singleton;
  if durable_lsn is distinct from acknowledged_lsn then
    raise exception 'Separate acknowledgement did not match durable evidence.';
  end if;
end;
$$;

-- Synthetic committed evidence exercises finalization with fixed historical
-- cutoffs while leaving the real transaction consumer checks above intact.
do $$
declare
  base_sunday date := date_trunc('week', current_date)::date + 6 - 21;
  durable_position pg_lsn;
  finalized boolean;
  result_row public.group_weekly_results%rowtype;
  display_row record;
  weight_value jsonb;
  cutoff timestamptz;
  moved_cutoff timestamptz;
  revoked_cutoff timestamptz;
  win_counts jsonb;
begin
  select durable_lsn into durable_position
  from public.group_weekly_result_control where singleton;
  update public.group_weekly_result_control
  set effective_from_sunday = base_sunday where singleton;

  if public.finalize_group_weekly_result(
    '40400000-0000-4000-8000-000000000001', base_sunday
  ) is distinct from true then
    raise exception 'The configured first eligible Sunday could not be finalized.';
  end if;
  select * into result_row from public.group_weekly_results
  where challenge_id = '40400000-0000-4000-8000-000000000001'
    and sunday = base_sunday;
  if result_row.result_state <> 'no_eligible_candidates' then
    raise exception 'The exact rollout-boundary Sunday was not finalized consistently.';
  end if;

  insert into public.group_weekly_result_events(
    event_id, challenge_id, event_kind, user_id, source_xid,
    transaction_ordinal, commit_lsn, committed_at, payload
  ) values
    ('40400000-0000-4000-8000-000000000101', '40400000-0000-4000-8000-000000000001', 'membership', '00000000-0000-4000-8000-000000000001', '9901', 1, durable_position, (base_sunday + 1)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000101','kind','membership','challenge_id','40400000-0000-4000-8000-000000000001','participant_id','40400000-0000-4000-8000-000000000011','user_id','00000000-0000-4000-8000-000000000001','display_name','Weekly owner','status','active','joined_at',(base_sunday - 1)::timestamp at time zone 'UTC','withdrawn_at',null)),
    ('40400000-0000-4000-8000-000000000102', '40400000-0000-4000-8000-000000000001', 'membership', '00000000-0000-4000-8000-000000000002', '9901', 2, durable_position, (base_sunday + 1)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000102','kind','membership','challenge_id','40400000-0000-4000-8000-000000000001','participant_id','40400000-0000-4000-8000-000000000012','user_id','00000000-0000-4000-8000-000000000002','display_name','Weekly member','status','active','joined_at',(base_sunday - 1)::timestamp at time zone 'UTC','withdrawn_at',null)),
    ('40400000-0000-4000-8000-000000000103', '40400000-0000-4000-8000-000000000001', 'weigh_in', '00000000-0000-4000-8000-000000000001', '9902', 1, durable_position, (base_sunday + 8)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000103','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 7,'weight_kg',80,'shared',true)),
    ('40400000-0000-4000-8000-000000000104', '40400000-0000-4000-8000-000000000001', 'weigh_in', '00000000-0000-4000-8000-000000000002', '9902', 2, durable_position, (base_sunday + 8)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000104','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000002','recorded_date',base_sunday + 7,'weight_kg',82,'shared',true)),
    ('40400000-0000-4000-8000-000000000105', '40400000-0000-4000-8000-000000000001', 'weigh_in', '00000000-0000-4000-8000-000000000001', '9903', 1, durable_position, (base_sunday + 15)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000105','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 14,'weight_kg',78,'shared',true)),
    ('40400000-0000-4000-8000-000000000106', '40400000-0000-4000-8000-000000000001', 'weigh_in', '00000000-0000-4000-8000-000000000002', '9903', 2, durable_position, (base_sunday + 15)::timestamp at time zone 'UTC', jsonb_build_object('event_id','40400000-0000-4000-8000-000000000106','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000002','recorded_date',base_sunday + 14,'weight_kg',80,'shared',true));

  finalized := public.finalize_group_weekly_result(
    '40400000-0000-4000-8000-000000000001', base_sunday + 7
  );
  if not finalized then raise exception 'Initial no-data result did not finalize.'; end if;
  select * into result_row from public.group_weekly_results
  where challenge_id = '40400000-0000-4000-8000-000000000001'
    and sunday = base_sunday + 7;
  if result_row.result_state <> 'no_eligible_candidates'
     or result_row.eligible_participant_count <> 0 then
    raise exception 'Missing Sunday endpoints did not finalize as no eligible candidates.';
  end if;

  finalized := public.finalize_group_weekly_result(
    '40400000-0000-4000-8000-000000000001', base_sunday + 14
  );
  if not finalized then raise exception 'Initial tied result did not finalize.'; end if;
  select * into result_row from public.group_weekly_results
  where challenge_id = '40400000-0000-4000-8000-000000000001'
    and sunday = base_sunday + 14;
  if result_row.result_state <> 'shared_winners'
     or result_row.winner_names <> array['Weekly member', 'Weekly owner']::text[]
     or result_row.winner_count <> 2 then
    raise exception 'Finalized tied result was incorrect: %', row_to_json(result_row);
  end if;

  cutoff := ((base_sunday + 15)::timestamp + time '20:00') at time zone 'Europe/Bucharest';
  insert into public.group_weekly_result_events(
    event_id, challenge_id, event_kind, user_id, source_xid,
    transaction_ordinal, commit_lsn, committed_at, payload
  ) values (
    '40400000-0000-4000-8000-000000000107',
    '40400000-0000-4000-8000-000000000001', 'weigh_in',
    '00000000-0000-4000-8000-000000000002', '9904', 1,
    durable_position, cutoff,
    jsonb_build_object('event_id','40400000-0000-4000-8000-000000000107','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000002','recorded_date',base_sunday + 14,'weight_kg',70,'shared',true)
  );
  weight_value := public.group_weekly_value_at_sunday(
    '40400000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    base_sunday + 14, cutoff,
    (base_sunday - 1)::timestamp at time zone 'UTC'
  );
  if (weight_value ->> 'weight_kg')::numeric <> 80 then
    raise exception 'An event committed at the strict cutoff changed the selected value: %', weight_value;
  end if;

  -- A move committed after the deadline keeps the old Sunday for that award.
  moved_cutoff := ((base_sunday + 22)::timestamp + time '20:00')
    at time zone 'Europe/Bucharest';
  insert into public.group_weekly_result_events(
    event_id, challenge_id, event_kind, user_id, source_xid,
    transaction_ordinal, commit_lsn, committed_at, payload
  ) values
    ('40400000-0000-4000-8000-000000000108',
      '40400000-0000-4000-8000-000000000001', 'weigh_in',
      '00000000-0000-4000-8000-000000000001', '9905', 1,
      durable_position, moved_cutoff - interval '1 minute',
      jsonb_build_object('event_id','40400000-0000-4000-8000-000000000108','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 21,'weight_kg',76,'shared',true)),
    ('40400000-0000-4000-8000-000000000109',
      '40400000-0000-4000-8000-000000000001', 'weigh_in',
      '00000000-0000-4000-8000-000000000001', '9906', 1,
      durable_position, moved_cutoff + interval '1 minute',
      jsonb_build_object('event_id','40400000-0000-4000-8000-000000000109','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 21,'shared',false));
  weight_value := public.group_weekly_value_at_sunday(
    '40400000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    base_sunday + 21, moved_cutoff,
    (base_sunday - 1)::timestamp at time zone 'UTC'
  );
  if (weight_value ->> 'weight_kg')::numeric <> 76 then
    raise exception 'A post-cutoff Sunday-to-weekday move rewrote the locked Sunday value.';
  end if;

  -- A move committed before the deadline revokes the old Sunday endpoint.
  revoked_cutoff := ((base_sunday + 29)::timestamp + time '20:00')
    at time zone 'Europe/Bucharest';
  insert into public.group_weekly_result_events(
    event_id, challenge_id, event_kind, user_id, source_xid,
    transaction_ordinal, commit_lsn, committed_at, payload
  ) values
    ('40400000-0000-4000-8000-000000000110',
      '40400000-0000-4000-8000-000000000001', 'weigh_in',
      '00000000-0000-4000-8000-000000000001', '9907', 1,
      durable_position, revoked_cutoff - interval '2 minutes',
      jsonb_build_object('event_id','40400000-0000-4000-8000-000000000110','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 28,'weight_kg',75,'shared',true)),
    ('40400000-0000-4000-8000-000000000111',
      '40400000-0000-4000-8000-000000000001', 'weigh_in',
      '00000000-0000-4000-8000-000000000001', '9908', 1,
      durable_position, revoked_cutoff - interval '1 minute',
      jsonb_build_object('event_id','40400000-0000-4000-8000-000000000111','kind','weigh_in','challenge_id','40400000-0000-4000-8000-000000000001','user_id','00000000-0000-4000-8000-000000000001','recorded_date',base_sunday + 28,'shared',false));
  weight_value := public.group_weekly_value_at_sunday(
    '40400000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    base_sunday + 28, revoked_cutoff,
    (base_sunday - 1)::timestamp at time zone 'UTC'
  );
  if weight_value is not null then
    raise exception 'A pre-cutoff Sunday-to-weekday move left stale Sunday evidence.';
  end if;

  if public.finalize_group_weekly_result(
    '40400000-0000-4000-8000-000000000001', base_sunday + 14
  ) then raise exception 'A finalized result was rewritten on retry.'; end if;
  if not exists (
    select 1 from public.group_weekly_result_winners
    where challenge_id = '40400000-0000-4000-8000-000000000001'
      and sunday = base_sunday + 14 and display_name = 'Weekly member'
      and current_weight_kg = 80
  ) then raise exception 'A late correction rewrote the immutable award.'; end if;

  weight_value := public.group_weekly_value_at_sunday(
    '40400000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    base_sunday + 7, cutoff,
    (base_sunday + 8)::timestamp at time zone 'UTC'
  );
  if weight_value is not null then
    raise exception 'A weigh-in recorded before membership joined was eligible.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  select * into display_row from public.get_group_weekly_result_display(
    '40400000-0000-4000-8000-000000000001', base_sunday + 14
  );
  if display_row.result_state <> 'finalized'
     or display_row.winner_count <> 2
     or display_row.winner_names <> array['Weekly member', 'Weekly owner']::text[] then
    raise exception 'The public display RPC did not return the immutable result.';
  end if;
  select jsonb_agg(jsonb_build_object('name', counts.display_name, 'wins', counts.win_count)
    order by counts.display_name) into win_counts
  from public.get_group_weekly_win_counts('40400000-0000-4000-8000-000000000001') as counts;
  if win_counts <> '[{"name":"Weekly member","wins":1},{"name":"Weekly owner","wins":1}]'::jsonb then
    raise exception 'Standings did not use the finalized ties: %', win_counts;
  end if;
end;
$$;

-- A challenge deleted after source changes but before consumption leaves
-- unreferenced outbox payloads. The consumer must discard them and advance.
insert into public.participants(
  id, challenge_id, user_id, display_name, status,
  starting_weight_kg, target_weight_kg, joined_at
) values (
  '40400000-0000-4000-8000-000000000013',
  '40400000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  'Temporary member', 'active', 90, 80, now()
);
delete from public.challenges where id = '40400000-0000-4000-8000-000000000002';
set role service_role;
do $$
declare
  pass integer;
begin
  for pass in 1..8 loop
    perform public.persist_group_weekly_result_events();
    perform public.ack_group_weekly_result_events();
  end loop;
end;
$$;
reset role;

do $$
begin
  if exists (select 1 from public.group_weekly_result_events
    where challenge_id = '40400000-0000-4000-8000-000000000002') then
    raise exception 'A deleted challenge retained weekly result evidence.';
  end if;
  if exists (select 1 from public.group_weekly_result_outbox
    where payload::jsonb ->> 'challenge_id' = '40400000-0000-4000-8000-000000000002') then
    raise exception 'Deleted-challenge outbox rows were not consumed: %',
      (select jsonb_agg(payload::jsonb) from public.group_weekly_result_outbox
       where payload::jsonb ->> 'challenge_id' = '40400000-0000-4000-8000-000000000002');
  end if;
end;
$$;

select 'PASS: pgoutput persist/replay/ack, privacy, join/date boundaries, deletion, immutable awards, and standings';

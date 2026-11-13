-- Challenge-scoped weekly result evidence. The logical consumer is deliberately
-- not provisioned here: slot creation and pg_cron scheduling require an
-- operator-reviewed staging activation plan.
begin;

create table public.group_weekly_result_control (
  singleton boolean primary key default true check (singleton),
  slot_name text not null,
  database_name text not null,
  system_identifier text not null,
  effective_from_sunday date,
  durable_lsn pg_lsn not null,
  acknowledged_lsn pg_lsn not null,
  check (effective_from_sunday is null or extract(dow from effective_from_sunday) = 0)
);

create table public.group_weekly_result_outbox (
  payload text not null
);

create publication group_weekly_result_outbox_pub
  for table public.group_weekly_result_outbox
  with (publish = 'insert');

create table public.group_weekly_result_events (
  event_id uuid primary key,
  challenge_id uuid references public.challenges(id) on delete cascade,
  event_kind text not null check (event_kind in ('membership', 'weigh_in', 'barrier')),
  user_id uuid,
  source_xid text not null,
  transaction_ordinal integer not null check (transaction_ordinal > 0),
  commit_lsn pg_lsn not null,
  committed_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check ((event_kind = 'barrier') = (challenge_id is null))
);

create index group_weekly_result_events_lookup_idx
  on public.group_weekly_result_events
  (challenge_id, user_id, event_kind, committed_at, commit_lsn, transaction_ordinal);

create table public.group_weekly_results (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  sunday date not null check (extract(dow from sunday) = 0),
  finalized_at timestamptz not null,
  result_state text not null check (result_state in ('no_eligible_candidates', 'no_winners', 'winner', 'shared_winners')),
  active_participant_count integer not null check (active_participant_count >= 0),
  eligible_participant_count integer not null check (eligible_participant_count >= 0),
  winner_count integer not null check (winner_count >= 0),
  winner_names text[] not null default '{}',
  barrier_commit_lsn pg_lsn not null,
  coverage_barrier_at timestamptz not null,
  primary key (challenge_id, sunday),
  check (winner_count = cardinality(winner_names))
);

create table public.group_weekly_result_winners (
  challenge_id uuid not null,
  sunday date not null,
  participant_id uuid not null,
  display_name text not null,
  weight_change_kg numeric(8, 3) not null,
  previous_weight_kg numeric(8, 2) not null,
  current_weight_kg numeric(8, 2) not null,
  previous_is_estimated boolean not null,
  current_is_estimated boolean not null,
  endpoint_evidence jsonb not null check (jsonb_typeof(endpoint_evidence) = 'object'),
  primary key (challenge_id, sunday, participant_id),
  foreign key (challenge_id, sunday)
    references public.group_weekly_results(challenge_id, sunday) on delete cascade
);

alter table public.group_weekly_result_control enable row level security;
alter table public.group_weekly_result_outbox enable row level security;
alter table public.group_weekly_result_events enable row level security;
alter table public.group_weekly_results enable row level security;
alter table public.group_weekly_result_winners enable row level security;
revoke all on public.group_weekly_result_control,
  public.group_weekly_result_outbox,
  public.group_weekly_result_events,
  public.group_weekly_results,
  public.group_weekly_result_winners
  from public, anon, authenticated, service_role;

create function public.enqueue_group_weekly_result_event(target_payload jsonb)
returns void language sql security definer
set search_path = pg_catalog, public
as $$
  insert into public.group_weekly_result_outbox(payload)
  values (target_payload::text)
$$;
revoke all on function public.enqueue_group_weekly_result_event(jsonb)
  from public, anon, authenticated, service_role;

create function public.capture_group_weekly_membership()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  member_row public.participants%rowtype;
begin
  member_row := case when tg_op = 'DELETE' then old else new end;
  perform public.enqueue_group_weekly_result_event(jsonb_build_object(
    'event_id', gen_random_uuid(), 'kind', 'membership',
    'challenge_id', member_row.challenge_id, 'participant_id', member_row.id,
    'user_id', member_row.user_id,
    'display_name', member_row.display_name,
    'status', case when tg_op = 'DELETE' then 'removed' else member_row.status end,
    'joined_at', member_row.joined_at,
    'withdrawn_at', member_row.withdrawn_at
  ));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_group_weekly_membership() from public;
create trigger participants_capture_weekly_membership
  after insert or update or delete on public.participants
  for each row execute function public.capture_group_weekly_membership();

create function public.capture_group_weekly_weigh_in()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  entry_row public.personal_weigh_ins%rowtype;
  shared_challenge_id uuid;
begin
  if tg_op = 'DELETE' then return old; end if;
  entry_row := new;
  if tg_op = 'UPDATE' and (
    old.recorded_date is distinct from new.recorded_date
    or old.user_id is distinct from new.user_id
  ) then
    for shared_challenge_id in
      select share.challenge_id
      from public.personal_weigh_in_group_shares as share
      where share.personal_weigh_in_id = old.id
    loop
      perform public.enqueue_group_weekly_result_event(jsonb_build_object(
        'event_id', gen_random_uuid(), 'kind', 'weigh_in',
        'challenge_id', shared_challenge_id, 'user_id', old.user_id,
        'recorded_date', old.recorded_date, 'shared', false
      ));
    end loop;
  end if;
  for shared_challenge_id in
    select share.challenge_id
    from public.personal_weigh_in_group_shares as share
    where share.personal_weigh_in_id = entry_row.id
  loop
    perform public.enqueue_group_weekly_result_event(jsonb_build_object(
      'event_id', gen_random_uuid(), 'kind', 'weigh_in',
      'challenge_id', shared_challenge_id, 'user_id', entry_row.user_id,
      'recorded_date', entry_row.recorded_date,
      'weight_kg', entry_row.weight_kg, 'shared', true
    ));
  end loop;
  return new;
end;
$$;
revoke all on function public.capture_group_weekly_weigh_in() from public;
create trigger personal_weigh_ins_capture_weekly_update
  after update on public.personal_weigh_ins
  for each row execute function public.capture_group_weekly_weigh_in();

create function public.capture_group_weekly_weigh_in_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  shared_challenge_id uuid;
begin
  for shared_challenge_id in
    select share.challenge_id
    from public.personal_weigh_in_group_shares as share
    where share.personal_weigh_in_id = old.id
  loop
    perform public.enqueue_group_weekly_result_event(jsonb_build_object(
      'event_id', gen_random_uuid(), 'kind', 'weigh_in',
      'challenge_id', shared_challenge_id, 'user_id', old.user_id,
      'recorded_date', old.recorded_date, 'shared', false
    ));
  end loop;
  return old;
end;
$$;
revoke all on function public.capture_group_weekly_weigh_in_delete() from public;
create trigger personal_weigh_ins_capture_weekly_delete
  before delete on public.personal_weigh_ins
  for each row execute function public.capture_group_weekly_weigh_in_delete();

create function public.capture_group_weekly_share()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  entry_row public.personal_weigh_ins%rowtype;
  share_row public.personal_weigh_in_group_shares%rowtype;
  old_entry_row public.personal_weigh_ins%rowtype;
  is_shared boolean;
  event_payload jsonb;
begin
  if tg_op = 'UPDATE' and (
    old.personal_weigh_in_id is distinct from new.personal_weigh_in_id
    or old.challenge_id is distinct from new.challenge_id
  ) then
    select personal.* into old_entry_row
    from public.personal_weigh_ins as personal
    where personal.id = old.personal_weigh_in_id;
    if found then
      perform public.enqueue_group_weekly_result_event(jsonb_build_object(
        'event_id', gen_random_uuid(), 'kind', 'weigh_in',
        'challenge_id', old.challenge_id, 'user_id', old_entry_row.user_id,
        'recorded_date', old_entry_row.recorded_date, 'shared', false
      ));
    end if;
  end if;
  share_row := case when tg_op = 'DELETE' then old else new end;
  select personal.* into entry_row
  from public.personal_weigh_ins as personal
  where personal.id = share_row.personal_weigh_in_id;
  if not found then
    -- The parent weigh-in may be deleted in the same cascade. No private value
    -- is copied; any prior share snapshot remains governed by cutoff evidence.
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  is_shared := tg_op <> 'DELETE';
  event_payload := jsonb_build_object(
    'event_id', gen_random_uuid(), 'kind', 'weigh_in',
    'challenge_id', share_row.challenge_id, 'user_id', entry_row.user_id,
    'recorded_date', entry_row.recorded_date,
    'shared', is_shared
  );
  if is_shared then
    event_payload := event_payload || jsonb_build_object('weight_kg', entry_row.weight_kg);
  end if;
  perform public.enqueue_group_weekly_result_event(event_payload);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_group_weekly_share() from public;
create trigger personal_weigh_in_shares_capture_insert
  after insert on public.personal_weigh_in_group_shares
  for each row execute function public.capture_group_weekly_share();
create trigger personal_weigh_in_shares_capture_update
  after update on public.personal_weigh_in_group_shares
  for each row execute function public.capture_group_weekly_share();
create trigger personal_weigh_in_shares_capture_delete
  before delete on public.personal_weigh_in_group_shares
  for each row execute function public.capture_group_weekly_share();

create function public.capture_group_weekly_barrier()
returns void language sql security definer
set search_path = pg_catalog, public
as $$
  select public.enqueue_group_weekly_result_event(jsonb_build_object(
    'event_id', gen_random_uuid(), 'kind', 'barrier'
  ))
$$;
revoke all on function public.capture_group_weekly_barrier() from public, anon, authenticated;
grant execute on function public.capture_group_weekly_barrier() to service_role;

create function public.group_weekly_u16(target_data bytea, target_offset integer)
returns integer language sql immutable strict as $$
  select get_byte(target_data, target_offset) * 256
       + get_byte(target_data, target_offset + 1)
$$;

create function public.group_weekly_u32(target_data bytea, target_offset integer)
returns bigint language sql immutable strict as $$
  select get_byte(target_data, target_offset)::bigint * 16777216
       + get_byte(target_data, target_offset + 1)::bigint * 65536
       + get_byte(target_data, target_offset + 2)::bigint * 256
       + get_byte(target_data, target_offset + 3)::bigint
$$;

create function public.group_weekly_read_cstring(target_data bytea, target_start integer)
returns table(value text, next_offset integer)
language plpgsql immutable strict as $$
declare
  position integer := target_start;
  result text := '';
  current_byte integer;
begin
  while position < length(target_data) loop
    current_byte := get_byte(target_data, position);
    if current_byte = 0 then
      value := result;
      next_offset := position + 1;
      return next;
      return;
    end if;
    if current_byte > 127 then raise exception 'Non-ASCII pgoutput metadata is unsupported.'; end if;
    result := result || chr(current_byte);
    position := position + 1;
  end loop;
  raise exception 'Unterminated pgoutput metadata string.';
end;
$$;

create function public.group_weekly_validate_relation(target_data bytea)
returns oid language plpgsql immutable strict as $$
declare
  position integer := 5;
  relation_id oid;
  schema_name text;
  relation_name text;
  column_name text;
  column_type bigint;
  column_count integer;
  parsed record;
begin
  if length(target_data) < 12 or get_byte(target_data, 0) <> ascii('R') then
    raise exception 'Expected pgoutput Relation message.';
  end if;
  relation_id := public.group_weekly_u32(target_data, 1)::oid;
  select * into parsed from public.group_weekly_read_cstring(target_data, position);
  schema_name := parsed.value; position := parsed.next_offset;
  select * into parsed from public.group_weekly_read_cstring(target_data, position);
  relation_name := parsed.value; position := parsed.next_offset;
  if schema_name <> 'public' or relation_name <> 'group_weekly_result_outbox' then
    raise exception 'Unexpected pgoutput relation %.%.', schema_name, relation_name;
  end if;
  position := position + 1;
  column_count := public.group_weekly_u16(target_data, position); position := position + 2;
  if column_count <> 1 then raise exception 'Weekly outbox relation must have one column.'; end if;
  position := position + 1;
  select * into parsed from public.group_weekly_read_cstring(target_data, position);
  column_name := parsed.value; position := parsed.next_offset;
  column_type := public.group_weekly_u32(target_data, position);
  position := position + 8;
  if column_name <> 'payload' or column_type <> 25 or position <> length(target_data) then
    raise exception 'Weekly outbox schema changed; refusing to decode.';
  end if;
  if relation_id <> 'public.group_weekly_result_outbox'::regclass::oid then
    raise exception 'Weekly outbox relation identity changed; refusing to decode.';
  end if;
  return relation_id;
end;
$$;

create function public.group_weekly_decode_insert(target_data bytea, target_relation oid)
returns jsonb language plpgsql immutable strict as $$
declare
  field_length bigint;
  payload_text text;
begin
  if length(target_data) < 13 or get_byte(target_data, 0) <> ascii('I') then
    raise exception 'Expected pgoutput Insert message.';
  end if;
  if public.group_weekly_u32(target_data, 1)::oid <> target_relation
     or get_byte(target_data, 5) <> ascii('N')
     or public.group_weekly_u16(target_data, 6) <> 1
     or get_byte(target_data, 8) <> ascii('t') then
    raise exception 'Unexpected weekly outbox tuple format.';
  end if;
  field_length := public.group_weekly_u32(target_data, 9);
  if field_length < 2 or field_length <> length(target_data) - 13 then
    raise exception 'Invalid weekly outbox tuple length.';
  end if;
  payload_text := convert_from(substring(target_data from 14 for field_length::integer), 'UTF8');
  if jsonb_typeof(payload_text::jsonb) <> 'object'
     or not ((payload_text::jsonb) ? 'event_id')
     or not ((payload_text::jsonb) ? 'kind') then
    raise exception 'Weekly outbox payload is missing required fields.';
  end if;
  return payload_text::jsonb;
end;
$$;

create function public.group_weekly_timestamp_at(target_data bytea, target_offset integer)
returns timestamptz language plpgsql immutable strict as $$
declare
  microseconds numeric := 0;
  position integer;
begin
  for position in target_offset..target_offset + 7 loop
    microseconds := microseconds * 256 + get_byte(target_data, position);
  end loop;
  return to_timestamp(946684800 + microseconds / 1000000.0);
end;
$$;

create function public.persist_group_weekly_result_events()
returns integer language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  slot_value text;
  durable_value pg_lsn;
  acknowledged_value pg_lsn;
  slot_plugin text;
  slot_database text;
  slot_status text;
  slot_position pg_lsn;
  slot_restart_lsn pg_lsn;
  relation_id oid;
  transaction_xid text;
  transaction_time timestamptz;
  transaction_ordinal integer := 0;
  transaction_events jsonb[] := array[]::jsonb[];
  row_value record;
  message_kind text;
  event_payload jsonb;
  v_event_id uuid;
  event_challenge uuid;
  event_kind text;
  event_user uuid;
  affected integer;
  inserted_count integer := 0;
  existing_event public.group_weekly_result_events%rowtype;
begin
  perform pg_advisory_xact_lock(404404, 1);
  select control.slot_name, control.durable_lsn, control.acknowledged_lsn
    into slot_value, durable_value, acknowledged_value
  from public.group_weekly_result_control as control
  where control.singleton for update;
  if not found then raise exception 'Weekly result consumer is not initialized.'; end if;
  if (select control.database_name from public.group_weekly_result_control as control where control.singleton)
       <> current_database()
     or (select control.system_identifier from public.group_weekly_result_control as control where control.singleton)
       <> (select system_identifier::text from pg_catalog.pg_control_system()) then
    raise exception 'Weekly result database identity mismatch.';
  end if;
  select slot.plugin, slot.database, slot.wal_status,
         slot.confirmed_flush_lsn, slot.restart_lsn
    into slot_plugin, slot_database, slot_status, slot_position, slot_restart_lsn
  from pg_catalog.pg_replication_slots as slot
  where slot.slot_name = slot_value;
  if not found then raise exception 'Weekly result slot is missing; refusing to recreate.'; end if;
  if slot_plugin <> 'pgoutput' or slot_database <> current_database() then
    raise exception 'Weekly result slot identity mismatch.';
  end if;
  if slot_status in ('lost', 'unreserved') or slot_restart_lsn is null then
    raise exception 'Weekly result WAL is unavailable; refusing to continue.';
  end if;
  if slot_position > durable_value then raise exception 'Slot advanced beyond durable evidence.'; end if;
  if slot_position < acknowledged_value then raise exception 'Slot position moved backwards.'; end if;

  for row_value in
    select decoded.lsn, decoded.xid, decoded.data, decoded.ordinality
    from pg_catalog.pg_logical_slot_peek_binary_changes(
      slot_value, null, 1,
      'proto_version', '1', 'publication_names', 'group_weekly_result_outbox_pub'
    ) with ordinality as decoded(lsn, xid, data, ordinality)
    order by decoded.ordinality
  loop
    message_kind := chr(get_byte(row_value.data, 0));
    if message_kind = 'R' then
      relation_id := public.group_weekly_validate_relation(row_value.data);
    elsif message_kind = 'B' then
      if length(row_value.data) <> 21 or transaction_xid is not null then
        raise exception 'Malformed or nested pgoutput Begin message.';
      end if;
      transaction_xid := row_value.xid::text;
      if public.group_weekly_u32(row_value.data, 17)::text <> transaction_xid then
        raise exception 'Begin XID did not match the decoded transaction.';
      end if;
      transaction_time := public.group_weekly_timestamp_at(row_value.data, 9);
      transaction_ordinal := 0;
      transaction_events := array[]::jsonb[];
    elsif message_kind = 'I' then
      if transaction_xid is null or transaction_xid <> row_value.xid::text or relation_id is null then
        raise exception 'Outbox Insert arrived outside a validated transaction/relation.';
      end if;
      event_payload := public.group_weekly_decode_insert(row_value.data, relation_id);
      transaction_events := array_append(transaction_events, event_payload);
    elsif message_kind = 'C' then
      if transaction_xid is null or transaction_xid <> row_value.xid::text
         or cardinality(transaction_events) = 0
         or length(row_value.data) <> 26 or get_byte(row_value.data, 1) <> 0 then
        raise exception 'Malformed or unmatched pgoutput Commit message.';
      end if;
      if public.group_weekly_timestamp_at(row_value.data, 18) <> transaction_time then
        raise exception 'Begin and Commit timestamps disagree.';
      end if;
      foreach event_payload in array transaction_events loop
        transaction_ordinal := transaction_ordinal + 1;
        v_event_id := (event_payload ->> 'event_id')::uuid;
        event_kind := event_payload ->> 'kind';
        if event_kind not in ('membership', 'weigh_in', 'barrier') then
          raise exception 'Unsupported weekly result event kind.';
        end if;
        event_challenge := nullif(event_payload ->> 'challenge_id', '')::uuid;
        event_user := nullif(event_payload ->> 'user_id', '')::uuid;
        if (event_kind = 'barrier') <> (event_challenge is null) then
          raise exception 'Weekly result event scope is invalid.';
        end if;
        select ledger.* into existing_event
        from public.group_weekly_result_events as ledger
        where ledger.event_id = v_event_id;
        if found then
          if existing_event.payload is distinct from event_payload
             or existing_event.source_xid is distinct from transaction_xid
             or existing_event.commit_lsn is distinct from row_value.lsn
             or existing_event.committed_at is distinct from transaction_time
             or existing_event.transaction_ordinal is distinct from transaction_ordinal then
            raise exception 'Duplicate weekly event ID has conflicting payload.';
          end if;
        elsif event_challenge is null or exists (
          select 1 from public.challenges as challenge where challenge.id = event_challenge
        ) then
          insert into public.group_weekly_result_events(
            event_id, challenge_id, event_kind, user_id, source_xid,
            transaction_ordinal, commit_lsn, committed_at, payload
          ) values (
            v_event_id, event_challenge, event_kind, event_user, transaction_xid,
            transaction_ordinal, row_value.lsn, transaction_time, event_payload
          );
          get diagnostics affected = row_count;
          inserted_count := inserted_count + affected;
        end if;
        delete from public.group_weekly_result_outbox as outbox
        where (outbox.payload::jsonb ->> 'event_id')::uuid = v_event_id;
      end loop;
      durable_value := greatest(durable_value, row_value.lsn);
      update public.group_weekly_result_control as control
        set durable_lsn = durable_value where control.singleton;
      transaction_xid := null;
      transaction_time := null;
      transaction_ordinal := 0;
      transaction_events := array[]::jsonb[];
    else
      raise exception 'Unsupported pgoutput message type %; refusing to advance.', message_kind;
    end if;
  end loop;
  if transaction_xid is not null then raise exception 'Peek batch ended inside a transaction.'; end if;
  delete from public.group_weekly_result_events as event
  where event.event_kind = 'barrier'
    and event.event_id <> (
      select latest.event_id from public.group_weekly_result_events as latest
      where latest.event_kind = 'barrier'
      order by latest.commit_lsn desc, latest.transaction_ordinal desc
      limit 1
    );
  return inserted_count;
end;
$$;

create function public.ack_group_weekly_result_events()
returns pg_lsn language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  slot_value text;
  durable_value pg_lsn;
  acknowledged_value pg_lsn;
  slot_position pg_lsn;
  slot_restart_lsn pg_lsn;
  slot_status text;
  slot_database text;
  system_identifier text;
  advanced record;
begin
  perform pg_advisory_xact_lock(404404, 1);
  select control.slot_name, control.durable_lsn, control.acknowledged_lsn
    into slot_value, durable_value, acknowledged_value
  from public.group_weekly_result_control as control
  where control.singleton for update;
  if not found then raise exception 'Weekly result consumer is not initialized.'; end if;
  select slot.confirmed_flush_lsn, slot.wal_status, slot.restart_lsn, slot.database
    into slot_position, slot_status, slot_restart_lsn, slot_database
  from pg_catalog.pg_replication_slots as slot
  where slot.slot_name = slot_value and slot.plugin = 'pgoutput'
    and slot.database = current_database();
  if not found then raise exception 'Weekly result slot is missing or has changed identity.'; end if;
  select control.system_identifier into system_identifier
  from public.group_weekly_result_control as control where control.singleton;
  if system_identifier <> (select current_system.system_identifier::text
    from pg_catalog.pg_control_system() as current_system) then
    raise exception 'Weekly result database system identity changed.';
  end if;
  if slot_database <> current_database() or slot_status in ('lost', 'unreserved')
     or slot_restart_lsn is null then
    raise exception 'Weekly result WAL is unavailable or slot identity changed.';
  end if;
  if slot_position > durable_value then raise exception 'Slot advanced beyond durable evidence.'; end if;
  if slot_position < acknowledged_value then raise exception 'Slot position moved backwards.'; end if;
  if slot_position = durable_value then
    update public.group_weekly_result_control set acknowledged_lsn = slot_position where singleton;
    return slot_position;
  end if;
  select * into advanced
  from pg_catalog.pg_replication_slot_advance(slot_value, durable_value);
  if advanced.end_lsn <> durable_value then
    raise exception 'Slot did not reach exactly the durable watermark.';
  end if;
  update public.group_weekly_result_control set acknowledged_lsn = advanced.end_lsn where singleton;
  return advanced.end_lsn;
end;
$$;

revoke all on function public.group_weekly_u16(bytea, integer),
  public.group_weekly_u32(bytea, integer),
  public.group_weekly_read_cstring(bytea, integer),
  public.group_weekly_validate_relation(bytea),
  public.group_weekly_decode_insert(bytea, oid),
  public.group_weekly_timestamp_at(bytea, integer),
  public.persist_group_weekly_result_events(),
  public.ack_group_weekly_result_events()
  from public, anon, authenticated;
grant execute on function public.persist_group_weekly_result_events(),
  public.ack_group_weekly_result_events() to service_role;

create function public.initialize_group_weekly_results(target_effective_from_sunday date)
returns void language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  slot_position pg_lsn;
  slot_database text;
  slot_plugin text;
  slot_status text;
  slot_restart_lsn pg_lsn;
begin
  if target_effective_from_sunday is null
     or extract(dow from target_effective_from_sunday) <> 0 then
    raise exception using errcode = '22023', message = 'A Sunday rollout date is required.';
  end if;
  perform pg_advisory_xact_lock(404404, 2);
  if exists (select 1 from public.group_weekly_result_control) then
    raise exception 'Weekly result rollout is already initialized.';
  end if;
  lock table public.participants,
    public.personal_weigh_ins,
    public.personal_weigh_in_group_shares in share mode;
  select slot.confirmed_flush_lsn, slot.database, slot.plugin,
         slot.wal_status, slot.restart_lsn
    into slot_position, slot_database, slot_plugin, slot_status, slot_restart_lsn
  from pg_catalog.pg_replication_slots as slot
  where slot.slot_name = 'slimpossible_group_weekly_results_v1';
  if not found or slot_plugin <> 'pgoutput' or slot_database <> current_database()
     or slot_status in ('lost', 'unreserved') or slot_restart_lsn is null then
    raise exception 'The approved logical slot is not ready for initialization.';
  end if;
  insert into public.group_weekly_result_control(
    singleton, slot_name, database_name, system_identifier,
    effective_from_sunday, durable_lsn, acknowledged_lsn
  ) select true, 'slimpossible_group_weekly_results_v1', current_database(),
      system_identifier::text, target_effective_from_sunday,
      slot_position, slot_position
    from pg_catalog.pg_control_system();

  -- Discard trigger rows written before the slot existed. The baseline below
  -- snapshots only current membership and explicitly shared values after the
  -- slot's start position; no historical awards are created.
  delete from public.group_weekly_result_outbox;

  insert into public.group_weekly_result_outbox(payload)
  select jsonb_build_object(
    'event_id', gen_random_uuid(), 'kind', 'membership',
    'challenge_id', participant.challenge_id,
    'participant_id', participant.id, 'user_id', participant.user_id,
    'display_name', participant.display_name, 'status', participant.status,
    'joined_at', participant.joined_at, 'withdrawn_at', participant.withdrawn_at
  )::text
  from public.participants as participant
  join public.challenges as challenge on challenge.id = participant.challenge_id
  where challenge.challenge_kind is distinct from 'personal';

  insert into public.group_weekly_result_outbox(payload)
  select jsonb_build_object(
    'event_id', gen_random_uuid(), 'kind', 'weigh_in',
    'challenge_id', share.challenge_id, 'user_id', personal.user_id,
    'recorded_date', personal.recorded_date, 'weight_kg', personal.weight_kg,
    'shared', true
  )::text
  from public.personal_weigh_in_group_shares as share
  join public.personal_weigh_ins as personal
    on personal.id = share.personal_weigh_in_id;
end;
$$;
revoke all on function public.initialize_group_weekly_results(date)
  from public, anon, authenticated;
grant execute on function public.initialize_group_weekly_results(date) to service_role;

create function public.group_weekly_value_at_sunday(
  target_challenge uuid,
  target_user uuid,
  target_sunday date,
  target_cutoff timestamptz,
  target_joined_at timestamptz
)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  actual_event record;
  previous_event record;
  next_event record;
  elapsed_days numeric;
  span_days numeric;
  interpolated numeric;
begin
  select ledger.event_id, ledger.committed_at, ledger.payload
    into actual_event
  from public.group_weekly_result_events as ledger
  where ledger.challenge_id = target_challenge
    and ledger.user_id = target_user
    and ledger.event_kind = 'weigh_in'
    and ledger.committed_at >= target_joined_at
    and ledger.committed_at < target_cutoff
    and (ledger.payload ->> 'recorded_date')::date >=
      (target_joined_at at time zone 'Europe/Bucharest')::date
    and (ledger.payload ->> 'recorded_date')::date = target_sunday
  order by ledger.committed_at desc, ledger.commit_lsn desc,
    ledger.source_xid desc, ledger.transaction_ordinal desc
  limit 1;
  if found and (actual_event.payload ->> 'shared')::boolean then
    return jsonb_build_object(
      'weight_kg', (actual_event.payload ->> 'weight_kg')::numeric,
      'estimated', false,
      'date', target_sunday,
      'event_id', actual_event.event_id,
      'committed_at', actual_event.committed_at
    );
  end if;

  select latest.event_id, latest.committed_at, latest.payload
    into previous_event
  from (
    select distinct on ((ledger.payload ->> 'recorded_date')::date)
      ledger.event_id, ledger.committed_at, ledger.payload,
      (ledger.payload ->> 'recorded_date')::date as recorded_date
    from public.group_weekly_result_events as ledger
    where ledger.challenge_id = target_challenge
      and ledger.user_id = target_user
      and ledger.event_kind = 'weigh_in'
      and ledger.committed_at >= target_joined_at
      and ledger.committed_at < target_cutoff
      and (ledger.payload ->> 'recorded_date')::date >=
        (target_joined_at at time zone 'Europe/Bucharest')::date
      and (ledger.payload ->> 'recorded_date')::date < target_sunday
    order by (ledger.payload ->> 'recorded_date')::date,
      ledger.committed_at desc, ledger.commit_lsn desc,
      ledger.source_xid desc, ledger.transaction_ordinal desc
  ) as latest
  where (latest.payload ->> 'shared')::boolean
  order by latest.recorded_date desc
  limit 1;

  select latest.event_id, latest.committed_at, latest.payload
    into next_event
  from (
    select distinct on ((ledger.payload ->> 'recorded_date')::date)
      ledger.event_id, ledger.committed_at, ledger.payload,
      (ledger.payload ->> 'recorded_date')::date as recorded_date
    from public.group_weekly_result_events as ledger
    where ledger.challenge_id = target_challenge
      and ledger.user_id = target_user
      and ledger.event_kind = 'weigh_in'
      and ledger.committed_at >= target_joined_at
      and ledger.committed_at < target_cutoff
      and (ledger.payload ->> 'recorded_date')::date >=
        (target_joined_at at time zone 'Europe/Bucharest')::date
      and (ledger.payload ->> 'recorded_date')::date > target_sunday
    order by (ledger.payload ->> 'recorded_date')::date,
      ledger.committed_at desc, ledger.commit_lsn desc,
      ledger.source_xid desc, ledger.transaction_ordinal desc
  ) as latest
  where (latest.payload ->> 'shared')::boolean
  order by latest.recorded_date asc
  limit 1;
  if previous_event.event_id is null or next_event.event_id is null then return null; end if;

  elapsed_days := target_sunday - (previous_event.payload ->> 'recorded_date')::date;
  span_days := (next_event.payload ->> 'recorded_date')::date
    - (previous_event.payload ->> 'recorded_date')::date;
  if span_days <= 0 or elapsed_days <= 0 or elapsed_days >= span_days then return null; end if;
  interpolated := round((
    (previous_event.payload ->> 'weight_kg')::numeric
      + ((next_event.payload ->> 'weight_kg')::numeric
        - (previous_event.payload ->> 'weight_kg')::numeric)
        * elapsed_days / span_days
  ) * 20) / 20;
  return jsonb_build_object(
    'weight_kg', interpolated, 'estimated', true, 'date', target_sunday,
    'previous_event_id', previous_event.event_id,
    'previous_date', previous_event.payload ->> 'recorded_date',
    'previous_weight_kg', previous_event.payload ->> 'weight_kg',
    'previous_committed_at', previous_event.committed_at,
    'next_event_id', next_event.event_id,
    'next_date', next_event.payload ->> 'recorded_date',
    'next_weight_kg', next_event.payload ->> 'weight_kg',
    'next_committed_at', next_event.committed_at
  );
end;
$$;

create function public.finalize_group_weekly_result(
  target_challenge_id uuid,
  target_sunday date
)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  cutoff timestamptz;
  effective_from date;
  durable_position pg_lsn;
  barrier_lsn pg_lsn;
  barrier_at timestamptz;
  already_finalized boolean;
  active_count integer;
  eligible_count integer;
  winner_count integer;
  state_value text;
  names_value text[];
  winner_rows jsonb;
begin
  if target_sunday is null or extract(dow from target_sunday) <> 0 then
    raise exception using errcode = '22023', message = 'A Sunday result date is required.';
  end if;
  cutoff := ((target_sunday + 1)::timestamp + time '20:00') at time zone 'Europe/Bucharest';
  if clock_timestamp() < cutoff then
    raise exception using errcode = '22023', message = 'The Monday final cutoff has not arrived.';
  end if;
  select control.effective_from_sunday, control.durable_lsn
    into effective_from, durable_position
  from public.group_weekly_result_control as control where control.singleton;
  if not found or effective_from is null then
    raise exception 'Weekly result rollout has not been initialized.';
  end if;
  if target_sunday < effective_from then
    raise exception 'Weekly results before the first eligible Sunday are not backfilled.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_challenge_id::text || target_sunday::text, 404));
  select exists (
    select 1 from public.group_weekly_results as existing
    where existing.challenge_id = target_challenge_id and existing.sunday = target_sunday
  ) into already_finalized;
  if already_finalized then return false; end if;

  select event.commit_lsn, event.committed_at into barrier_lsn, barrier_at
  from public.group_weekly_result_events as event
  where event.event_kind = 'barrier'
    and event.committed_at >= cutoff
    and event.commit_lsn <= durable_position
  order by event.committed_at, event.commit_lsn, event.transaction_ordinal
  limit 1;
  if barrier_lsn is null then
    raise exception 'Post-cutoff event coverage barrier is not durable; result remains pending.';
  end if;

  with membership_versions as (
    select distinct on (event.payload ->> 'participant_id') event.payload,
      event.user_id, event.committed_at
    from public.group_weekly_result_events as event
    where event.challenge_id = target_challenge_id
      and event.event_kind = 'membership'
      and event.committed_at < cutoff
    order by event.payload ->> 'participant_id', event.committed_at desc,
      event.commit_lsn desc, event.source_xid desc, event.transaction_ordinal desc
  ), members as (
    select (version.payload ->> 'participant_id')::uuid as participant_id,
      version.user_id, version.payload ->> 'display_name' as display_name,
      (version.payload ->> 'joined_at')::timestamptz as joined_at
    from membership_versions as version
    where version.payload ->> 'status' = 'active'
      and (version.payload ->> 'joined_at')::timestamptz < cutoff
      and (version.payload ->> 'withdrawn_at' is null
        or (version.payload ->> 'withdrawn_at')::timestamptz > cutoff)
  ), candidates as (
    select member.participant_id, member.display_name,
      previous_value.value ->> 'weight_kg' as previous_weight,
      current_value.value ->> 'weight_kg' as current_weight,
      (previous_value.value ->> 'estimated')::boolean as previous_estimated,
      (current_value.value ->> 'estimated')::boolean as current_estimated,
      (current_value.value ->> 'weight_kg')::numeric
        - (previous_value.value ->> 'weight_kg')::numeric as weight_change,
      jsonb_build_object('previous', previous_value.value, 'current', current_value.value) as evidence
    from members as member
    cross join lateral (select public.group_weekly_value_at_sunday(
      target_challenge_id, member.user_id, target_sunday - 7, cutoff, member.joined_at
    ) as value) as previous_value
    cross join lateral (select public.group_weekly_value_at_sunday(
      target_challenge_id, member.user_id, target_sunday, cutoff, member.joined_at
    ) as value) as current_value
    where previous_value.value is not null and current_value.value is not null
  ), best as (
    select min(candidate.weight_change) as weight_change from candidates as candidate
  ), winners as (
    select candidate.* from candidates as candidate cross join best
    where candidate.weight_change = best.weight_change
  )
  select
    (select count(*) from members),
    (select count(*) from candidates),
    (select count(*) from winners),
    coalesce((select array_agg(winner.display_name order by winner.display_name) from winners as winner), '{}'),
    coalesce((select jsonb_agg(jsonb_build_object(
      'participant_id', winner.participant_id,
      'display_name', winner.display_name,
      'weight_change_kg', winner.weight_change,
      'previous_weight_kg', winner.previous_weight,
      'current_weight_kg', winner.current_weight,
      'previous_is_estimated', winner.previous_estimated,
      'current_is_estimated', winner.current_estimated,
      'endpoint_evidence', winner.evidence
    ) order by winner.display_name, winner.participant_id) from winners as winner), '[]'::jsonb)
  into active_count, eligible_count, winner_count, names_value, winner_rows;

  state_value := case
    when eligible_count = 0 then 'no_eligible_candidates'
    when winner_count = 1 then 'winner'
    else 'shared_winners'
  end;
  insert into public.group_weekly_results(
    challenge_id, sunday, finalized_at, result_state,
    active_participant_count, eligible_participant_count,
    winner_count, winner_names, barrier_commit_lsn, coverage_barrier_at
  ) values (
    target_challenge_id, target_sunday, clock_timestamp(), state_value,
    active_count, eligible_count, winner_count, names_value, barrier_lsn, barrier_at
  ) on conflict (challenge_id, sunday) do nothing;

  insert into public.group_weekly_result_winners(
    challenge_id, sunday, participant_id, display_name, weight_change_kg,
    previous_weight_kg, current_weight_kg, previous_is_estimated,
    current_is_estimated, endpoint_evidence
  )
  select target_challenge_id, target_sunday,
    (winner.value ->> 'participant_id')::uuid,
    winner.value ->> 'display_name',
    (winner.value ->> 'weight_change_kg')::numeric,
    (winner.value ->> 'previous_weight_kg')::numeric,
    (winner.value ->> 'current_weight_kg')::numeric,
    (winner.value ->> 'previous_is_estimated')::boolean,
    (winner.value ->> 'current_is_estimated')::boolean,
    winner.value -> 'endpoint_evidence'
  from jsonb_array_elements(winner_rows) as winner(value)
  on conflict (challenge_id, sunday, participant_id) do nothing;
  return true;
end;
$$;

create function public.get_group_weekly_result_display(
  target_challenge_id uuid,
  target_sunday date
)
returns table (
  result_state text,
  finalized_at timestamptz,
  active_participant_count integer,
  eligible_participant_count integer,
  winner_count integer,
  winner_names text[]
)
language plpgsql volatile security definer
set search_path = pg_catalog, public, auth
as $$
declare
  now_at timestamptz := clock_timestamp();
  provisional_at timestamptz;
  final_at timestamptz;
  effective_from date;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if target_sunday is null or extract(dow from target_sunday) <> 0 then
    raise exception using errcode = '22023', message = 'A Sunday result date is required.';
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

  select control.effective_from_sunday into effective_from
  from public.group_weekly_result_control as control where control.singleton;
  if not found or effective_from is null then
    return query select 'disabled', null::timestamptz, 0, 0, 0, '{}'::text[];
    return;
  end if;
  if target_sunday < effective_from then
    return query select 'not_available', null::timestamptz, 0, 0, 0, '{}'::text[];
    return;
  end if;
  provisional_at := (target_sunday::timestamp + time '20:00') at time zone 'Europe/Bucharest';
  final_at := ((target_sunday + 1)::timestamp + time '20:00') at time zone 'Europe/Bucharest';

  return query
  select 'finalized', result.finalized_at, result.active_participant_count,
    result.eligible_participant_count, result.winner_count, result.winner_names
  from public.group_weekly_results as result
  where result.challenge_id = target_challenge_id and result.sunday = target_sunday;
  if found then return; end if;
  if now_at < provisional_at then
    return query select 'not_announced', null::timestamptz, 0, 0, 0, '{}'::text[];
    return;
  end if;
  if now_at >= final_at then
    return query select 'pending', null::timestamptz, 0, 0, 0, '{}'::text[];
    return;
  end if;

  return query
  with membership_versions as (
    select distinct on (event.payload ->> 'participant_id') event.payload,
      event.user_id, event.committed_at
    from public.group_weekly_result_events as event
    where event.challenge_id = target_challenge_id
      and event.event_kind = 'membership' and event.committed_at < now_at
    order by event.payload ->> 'participant_id', event.committed_at desc,
      event.commit_lsn desc, event.source_xid desc, event.transaction_ordinal desc
  ), members as (
    select (version.payload ->> 'participant_id')::uuid as participant_id,
      version.user_id, version.payload ->> 'display_name' as display_name,
      (version.payload ->> 'joined_at')::timestamptz as joined_at
    from membership_versions as version
    where version.payload ->> 'status' = 'active'
      and (version.payload ->> 'joined_at')::timestamptz < now_at
      and (version.payload ->> 'withdrawn_at' is null
        or (version.payload ->> 'withdrawn_at')::timestamptz > now_at)
  ), candidates as (
    select member.participant_id, member.display_name,
      (current_value.value ->> 'weight_kg')::numeric
        - (previous_value.value ->> 'weight_kg')::numeric as weight_change
    from members as member
    cross join lateral (select public.group_weekly_value_at_sunday(
      target_challenge_id, member.user_id, target_sunday - 7, now_at, member.joined_at
    ) as value) as previous_value
    cross join lateral (select public.group_weekly_value_at_sunday(
      target_challenge_id, member.user_id, target_sunday, now_at, member.joined_at
    ) as value) as current_value
    where previous_value.value is not null and current_value.value is not null
  ), best as (
    select min(candidate.weight_change) as weight_change from candidates as candidate
  ), winners as (
    select candidate.* from candidates as candidate cross join best
    where candidate.weight_change = best.weight_change
  )
  select 'provisional', null::timestamptz,
    (select count(*)::integer from members),
    (select count(*)::integer from candidates),
    (select count(*)::integer from winners),
    coalesce((select array_agg(winner.display_name order by winner.display_name)
      from winners as winner), '{}'::text[]);
end;
$$;

-- Keep the established historical calculation before the rollout boundary;
-- after it, count only immutable finalized award rows. Provisional outcomes
-- never increase the challenge standings.
create or replace function public.get_group_weekly_win_counts(
  target_challenge_id uuid
)
returns table (
  member_key text,
  display_name text,
  win_count bigint
)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign-in required.';
  end if;
  if not exists (
    select 1 from public.challenges as challenge
    where challenge.id = target_challenge_id
      and challenge.challenge_kind is distinct from 'personal'
      and (challenge.owner_id = auth.uid() or exists (
        select 1 from public.participants as member
        where member.challenge_id = challenge.id
          and member.user_id = auth.uid() and member.status = 'active'
      ))
  ) then
    raise exception using errcode = '42501', message = 'Group membership required.';
  end if;

  return query
  with rollout as (
    select control.effective_from_sunday
    from public.group_weekly_result_control as control
    where control.singleton
  ), active_participants as (
    select participant.id, participant.user_id, participant.display_name
    from public.participants as participant
    where participant.challenge_id = target_challenge_id
      and participant.status = 'active'
  ), legacy_sundays as (
    select distinct current_entry.recorded_date as current_sunday
    from public.personal_weigh_ins as current_entry
    join public.personal_weigh_in_group_shares as current_share
      on current_share.personal_weigh_in_id = current_entry.id
     and current_share.challenge_id = target_challenge_id
    where extract(dow from current_entry.recorded_date) = 0
      and current_entry.recorded_date < current_date
      and (not exists (select 1 from rollout)
        or (select rollout.effective_from_sunday from rollout) is null
        or current_entry.recorded_date < (select rollout.effective_from_sunday from rollout))
  ), legacy_results as (
    select result.participant_id, sunday.current_sunday
    from legacy_sundays as sunday
    cross join lateral public._get_group_weekly_result(
      target_challenge_id, sunday.current_sunday
    ) as result
    where result.is_winner
  ), legacy_counts as (
    select result.participant_id, count(distinct result.current_sunday)::bigint as wins
    from legacy_results as result group by result.participant_id
  ), finalized_counts as (
    select winner.participant_id, count(*)::bigint as wins
    from public.group_weekly_result_winners as winner
    join public.group_weekly_results as result
      on result.challenge_id = winner.challenge_id and result.sunday = winner.sunday
    where winner.challenge_id = target_challenge_id
    group by winner.participant_id
  )
  select md5(target_challenge_id::text || ':' || participant.user_id::text),
    participant.display_name,
    coalesce(legacy.wins, 0) + coalesce(finalized.wins, 0)
  from active_participants as participant
  left join legacy_counts as legacy on legacy.participant_id = participant.id
  left join finalized_counts as finalized on finalized.participant_id = participant.id
  order by participant.display_name, participant.id;
end;
$$;

create function public.finalize_due_group_weekly_results()
returns integer language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  effective_from date;
  durable_position pg_lsn;
  latest_sunday date;
  target_sunday date;
  challenge record;
  cutoff timestamptz;
  finalized_count integer := 0;
begin
  select control.effective_from_sunday, control.durable_lsn
    into effective_from, durable_position
  from public.group_weekly_result_control as control where control.singleton;
  if not found or effective_from is null then return 0; end if;
  latest_sunday := date_trunc(
    'week', clock_timestamp() at time zone 'Europe/Bucharest'
  )::date + 6;
  for challenge in
    select row.id from public.challenges as row
    where row.challenge_kind is distinct from 'personal'
      and row.status <> 'draft'
  loop
    for target_sunday in
      select (series.week_start)::date
      from generate_series(
        (effective_from + 7)::timestamp,
        latest_sunday::timestamp,
        interval '7 days'
      ) as series(week_start)
    loop
      cutoff := ((target_sunday + 1)::timestamp + time '20:00')
        at time zone 'Europe/Bucharest';
      if cutoff <= clock_timestamp() and exists (
        select 1 from public.group_weekly_result_events as event
        where event.event_kind = 'barrier'
          and event.committed_at >= cutoff
          and event.commit_lsn <= durable_position
      ) then
        if public.finalize_group_weekly_result(challenge.id, target_sunday) then
          finalized_count := finalized_count + 1;
        end if;
      end if;
    end loop;
  end loop;
  return finalized_count;
end;
$$;

revoke all on function public.group_weekly_value_at_sunday(uuid, uuid, date, timestamptz, timestamptz),
  public.finalize_group_weekly_result(uuid, date),
  public.get_group_weekly_result_display(uuid, date)
  from public, anon, authenticated;
grant execute on function public.finalize_group_weekly_result(uuid, date) to service_role;
grant execute on function public.get_group_weekly_result_display(uuid, date) to authenticated;
revoke all on function public.finalize_due_group_weekly_results()
  from public, anon, authenticated;
grant execute on function public.finalize_due_group_weekly_results() to service_role;
revoke all on function public.get_group_weekly_win_counts(uuid)
  from public, anon, authenticated;
grant execute on function public.get_group_weekly_win_counts(uuid) to authenticated;

commit;

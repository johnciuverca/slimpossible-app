-- Connected staging-only, rollback-only authorization checks for opt-in group
-- history. The owner must explicitly supply three existing disposable Auth
-- UUIDs. Run this whole file as postgres in one SQL-editor batch; never commit.
-- Unfilled, malformed, missing, or duplicate identities fail before fixture DML.

begin;

select set_config('slimpossible.history_owner_id', 'REPLACE_OWNER_UUID', true);
select set_config('slimpossible.history_member_id', 'REPLACE_MEMBER_UUID', true);
select set_config('slimpossible.history_outsider_id', 'REPLACE_OUTSIDER_UUID', true);

drop table if exists pg_temp.slimpossible_group_history_results;
create temp table slimpossible_group_history_results (
  check_name text primary key,
  passed boolean not null
);
grant all on table slimpossible_group_history_results to authenticated, anon;

do $$
declare
  owner_id uuid;
  member_id uuid;
  outsider_id uuid;
  user_count integer;
  challenge_id uuid := gen_random_uuid();
  personal_challenge_id uuid := gen_random_uuid();
  outsider_challenge_id uuid := gen_random_uuid();
  member_participant_id uuid := gen_random_uuid();
  outsider_participant_id uuid := gen_random_uuid();
  visible_count integer;
  summary jsonb;
begin
  -- Parse and validate all identities before touching persistent application data.
  owner_id := current_setting('slimpossible.history_owner_id')::uuid;
  member_id := current_setting('slimpossible.history_member_id')::uuid;
  outsider_id := current_setting('slimpossible.history_outsider_id')::uuid;
  if owner_id = member_id or owner_id = outsider_id or member_id = outsider_id then
    raise exception 'Owner, member, and outsider must be distinct approved disposable users.';
  end if;
  select count(*)::integer into user_count
  from auth.users
  where id in (owner_id, member_id, outsider_id);
  if user_count <> 3 then
    raise exception 'All three explicitly approved disposable Auth users must exist; found %.', user_count;
  end if;

  -- Do not overwrite any existing profile or its display name.
  insert into public.profiles (id, display_name)
  values
    (owner_id, '[16.2 disposable] owner'),
    (member_id, '[16.2 disposable] member'),
    (outsider_id, '[16.2 disposable] outsider')
  on conflict (id) do nothing;

  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (challenge_id, owner_id, owner_id, '[16.2 disposable] group history', current_date - 30, current_date + 30, 'active', 'group'),
    (personal_challenge_id, owner_id, owner_id, '[16.2 disposable] personal', current_date - 30, current_date + 30, 'active', 'personal'),
    (outsider_challenge_id, outsider_id, outsider_id, '[16.2 disposable] outsider group', current_date - 30, current_date + 30, 'active', 'group');

  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (member_participant_id, challenge_id, member_id, '[16.2 disposable] member', 'active', 90, 80, now()),
    (outsider_participant_id, outsider_challenge_id, outsider_id, '[16.2 disposable] outsider', 'active', 90, 80, now());

  -- Existing/default-private rows stay private; only explicit opt-ins are visible.
  insert into public.weigh_ins (participant_id, recorded_date, weight_kg, note)
  values (member_participant_id, current_date - 21, 102, '[16.2 private] default private note');
  insert into public.weigh_ins (
    participant_id, recorded_date, weight_kg, note, share_with_group
  ) values
    (member_participant_id, current_date - 14, 100, '[16.2 private] shared-row note', true),
    (member_participant_id, current_date - 7, 98.5, '[16.2 private] second-row note', true),
    (member_participant_id, current_date + 1, 97, '[16.2 private] future note', true),
    (outsider_participant_id, current_date - 7, 85, '[16.2 private] outsider note', true);

  -- Both no-session and anon callers are denied, even with a valid challenge ID.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.get_group_weigh_in_history(challenge_id);
    insert into slimpossible_group_history_results values ('unauthenticated_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('unauthenticated_denied', true);
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform * from public.get_group_weigh_in_history(challenge_id);
    insert into slimpossible_group_history_results values ('anon_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('anon_denied', true);
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into visible_count
  from public.get_group_weigh_in_history(challenge_id);
  insert into slimpossible_group_history_results
  values ('active_member_sees_only_explicitly_shared_rows', visible_count = 2);
  insert into slimpossible_group_history_results values (
    'future_shared_row_is_not_yet_visible',
    not exists (
      select 1 from public.get_group_weigh_in_history(challenge_id)
      where recorded_date > current_date
    )
  );
  select to_jsonb(history) into summary
  from public.get_group_weigh_in_history(challenge_id) as history
  order by history.recorded_date desc limit 1;
  insert into slimpossible_group_history_results values (
    'projection_has_no_private_notes_or_identity_columns',
    not (summary ? 'note') and not (summary ? 'participant_id')
      and not (summary ? 'user_id') and not (summary ? 'email')
  );
  select count(*)::integer into visible_count from public.weigh_ins
  where participant_id = member_participant_id;
  insert into slimpossible_group_history_results
  values ('member_can_read_own_raw_weigh_in_rows', visible_count = 4);
  select count(*)::integer into visible_count from public.weigh_ins
  where participant_id = outsider_participant_id;
  insert into slimpossible_group_history_results
  values ('member_cannot_read_other_participant_raw_rows', visible_count = 0);

  update public.weigh_ins set weight_kg = 101
  where participant_id = member_participant_id
    and recorded_date = current_date - 14;
  select to_jsonb(history) into summary
  from public.get_group_weigh_in_history(challenge_id) as history
  order by history.recorded_date desc limit 1;
  insert into slimpossible_group_history_results values (
    'corrected_shared_row_recalculates_delta',
    summary -> 'change_since_previous_kg' = '-2.5'::jsonb
  );

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*)::integer into visible_count
  from public.get_group_weigh_in_history(challenge_id);
  insert into slimpossible_group_history_results
  values ('owner_sees_only_explicitly_shared_rows', visible_count = 2);
  select count(*)::integer into visible_count from public.weigh_ins
  where participant_id = member_participant_id;
  insert into slimpossible_group_history_results
  values ('owner_cannot_read_raw_member_rows_or_notes', visible_count = 0);
  begin
    perform * from public.get_group_weigh_in_history(personal_challenge_id);
    insert into slimpossible_group_history_results values ('personal_challenge_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('personal_challenge_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(challenge_id);
    insert into slimpossible_group_history_results values ('outsider_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('outsider_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(outsider_challenge_id);
    insert into slimpossible_group_history_results values ('cross_challenge_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('cross_challenge_denied', true);
  end;

  -- A member made withdrawn by the disposable fixtures loses access immediately.
  execute 'reset role';
  update public.participants set status = 'withdrawn'
  where id = member_participant_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(challenge_id);
    insert into slimpossible_group_history_results values ('withdrawn_member_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_history_results values ('withdrawn_member_denied', true);
  end;

  -- Unsharing one row removes it from both owner/member views without deleting it.
  execute 'reset role';
  update public.participants set status = 'active'
  where id = member_participant_id;
  update public.weigh_ins set share_with_group = false
  where participant_id = member_participant_id
    and recorded_date = current_date - 7;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into visible_count
  from public.get_group_weigh_in_history(challenge_id);
  insert into slimpossible_group_history_results
  values ('unshared_row_disappears_from_member_view', visible_count = 1);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*)::integer into visible_count
  from public.get_group_weigh_in_history(challenge_id);
  insert into slimpossible_group_history_results
  values ('unshared_row_disappears_from_owner_view', visible_count = 1);

  -- Re-share only the fixture row, then verify a member deletion removes it.
  update public.weigh_ins set share_with_group = true
  where participant_id = member_participant_id
    and recorded_date = current_date - 7;
  delete from public.weigh_ins
  where participant_id = member_participant_id
    and recorded_date = current_date - 7;
  select count(*)::integer into visible_count
  from public.get_group_weigh_in_history(challenge_id);
  insert into slimpossible_group_history_results
  values ('deletion_removes_shared_entry', visible_count = 1);

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select check_name, passed
from slimpossible_group_history_results
order by check_name;

do $$
begin
  if (select count(*) from slimpossible_group_history_results) <> 17
     or exists (select 1 from slimpossible_group_history_results where not passed) then
    raise exception 'Group weigh-in history authorization checks failed; roll back this batch.';
  end if;
end;
$$;

rollback;

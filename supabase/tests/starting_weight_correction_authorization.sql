-- Local-only Issue #265 authorization and preservation checks.
-- All synthetic fixtures roll back; run after all migrations in a disposable DB.
begin;
create temp table starting_weight_checks (
  check_name text primary key,
  passed boolean not null
);
grant all on starting_weight_checks to authenticated;
grant all on starting_weight_checks to anon;

do $$
declare
  group_owner uuid := '00000000-0000-4000-8000-000000000011';
  member uuid := '00000000-0000-4000-8000-000000000012';
  peer uuid := '00000000-0000-4000-8000-000000000013';
  outsider uuid := '00000000-0000-4000-8000-000000000014';
  withdrawn uuid := '00000000-0000-4000-8000-000000000015';
  personal_owner uuid := '00000000-0000-4000-8000-000000000016';
  personal_other uuid := '00000000-0000-4000-8000-000000000017';
  group_id uuid := gen_random_uuid();
  other_group_id uuid := gen_random_uuid();
  personal_id uuid := gen_random_uuid();
  owner_row uuid := gen_random_uuid();
  member_row uuid := gen_random_uuid();
  peer_row uuid := gen_random_uuid();
  withdrawn_row uuid := gen_random_uuid();
  personal_row uuid := gen_random_uuid();
  personal_other_row uuid := gen_random_uuid();
  entry_id uuid := gen_random_uuid();
  milestone_id uuid := gen_random_uuid();
  before_row public.participants%rowtype;
  after_row public.participants%rowtype;
  result_row record;
  visible integer;
begin
  insert into auth.users (id) values
    (group_owner), (member), (peer), (outsider), (withdrawn),
    (personal_owner), (personal_other)
  on conflict (id) do nothing;
  insert into public.profiles (id, display_name) values
    (group_owner, 'Correction group owner'), (member, 'Correction member'),
    (peer, 'Correction peer'), (outsider, 'Correction outsider'),
    (withdrawn, 'Correction withdrawn'), (personal_owner, 'Personal owner'),
    (personal_other, 'Personal other')
  on conflict (id) do nothing;
  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (group_id, group_owner, group_owner, 'Correction group', current_date - 20, current_date + 20, 'active', 'group'),
    (other_group_id, outsider, outsider, 'Other correction group', current_date - 20, current_date + 20, 'active', 'group'),
    (personal_id, personal_owner, personal_owner, 'Private correction', current_date - 20, current_date + 20, 'active', 'personal');
  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (owner_row, group_id, group_owner, 'Group owner', 'active', 200, 150, current_date - 10),
    (member_row, group_id, member, 'Member alias', 'active', 100, 80, current_date - 8),
    (peer_row, group_id, peer, 'Peer alias', 'active', 120, 90, current_date - 7),
    (withdrawn_row, group_id, withdrawn, 'Withdrawn alias', 'withdrawn', 100, 80, current_date - 6),
    (gen_random_uuid(), other_group_id, outsider, 'Other group member', 'active', 120, 100, current_date - 5),
    (personal_row, personal_id, personal_owner, 'Private owner', 'active', 90, 90, current_date - 4),
    (personal_other_row, personal_id, personal_other, 'Unexpected other', 'active', 120, 100, current_date - 3);
  insert into public.personal_weigh_ins (
    id, user_id, recorded_date, weight_kg, note
  ) values
    (entry_id, member, current_date - 2, 90, 'private correction sentinel');
  insert into public.personal_weigh_in_group_shares (
    personal_weigh_in_id, challenge_id
  ) values (entry_id, group_id);
  insert into public.participant_target_milestones (
    id, challenge_id, participant_id, target_weight_kg, achieved_on
  ) values (milestone_id, group_id, member_row, 95, current_date - 2);

  select * into before_row from public.participants where id = member_row;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member::text, true);
  select * into result_row
  from public.correct_my_enrollment_starting_weight(group_id, 110);
  insert into starting_weight_checks values
    ('active_group_member_corrects_only_own_start',
      result_row.challenge_id = group_id
      and result_row.starting_weight_kg = 110
      and result_row.target_weight_kg = 80);
  execute 'reset role';
  select * into after_row from public.participants where id = member_row;
  insert into starting_weight_checks values
    ('participant_columns_other_than_start_are_unchanged',
      (to_jsonb(after_row) - 'starting_weight_kg') =
      (to_jsonb(before_row) - 'starting_weight_kg'));
  insert into starting_weight_checks values
    ('peer_baseline_is_unchanged',
      (select starting_weight_kg = 110 from public.participants where id = peer_row) = false
      and (select starting_weight_kg = 110 from public.participants where id = member_row));
  insert into starting_weight_checks values
    ('weigh_in_note_and_share_are_unchanged',
      (select weight_kg = 90 and note = 'private correction sentinel'
        from public.personal_weigh_ins where id = entry_id)
      and exists (select 1 from public.personal_weigh_in_group_shares
        where personal_weigh_in_id = entry_id and challenge_id = group_id));
  insert into starting_weight_checks values
    ('reached_target_milestone_is_preserved',
      exists (select 1 from public.participant_target_milestones
        where id = milestone_id and participant_id = member_row
          and target_weight_kg = 95 and achieved_on = current_date - 2));

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member::text, true);
  select * into result_row from public.get_group_member_progress(group_id)
  where member_key = md5(group_id::text || ':' || member::text);
  insert into starting_weight_checks values
    ('selected_group_projection_recalculates_progress',
      result_row.starting_weight_kg = 110
      and result_row.target_weight_kg = 80
      and result_row.completion_percentage = 66.7);

  -- Equality remains a valid already-reached enrollment without inventing dates.
  select * into result_row
  from public.correct_my_enrollment_starting_weight(group_id, 80);
  insert into starting_weight_checks values
    ('starting_weight_equal_to_target_is_allowed',
      result_row.starting_weight_kg = 80 and result_row.target_weight_kg = 80);
  select * into result_row from public.get_group_member_progress(group_id)
  where member_key = md5(group_id::text || ':' || member::text);
  insert into starting_weight_checks values
    ('equal_start_and_target_is_reached',
      result_row.completion_percentage = 100 and result_row.progress_state = 'reached');
  execute 'reset role';
  select count(*)::integer into visible from public.participant_target_milestones
  where participant_id = member_row;
  insert into starting_weight_checks values
    ('correction_does_not_create_or_erase_milestones', visible = 1);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', group_owner::text, true);
  select * into result_row
  from public.correct_my_enrollment_starting_weight(group_id, 210);
  insert into starting_weight_checks values
    ('group_owner_can_correct_own_row_only',
      result_row.starting_weight_kg = 210
      and (select starting_weight_kg = 80 from public.participants where id = member_row)
      and (select starting_weight_kg = 120 from public.participants where id = peer_row));

  perform set_config('request.jwt.claim.sub', personal_owner::text, true);
  select * into result_row
  from public.correct_my_enrollment_starting_weight(personal_id, 95);
  insert into starting_weight_checks values
    ('personal_challenge_owner_can_correct_own_enrollment',
      result_row.starting_weight_kg = 95 and result_row.target_weight_kg = 90);

  perform set_config('request.jwt.claim.sub', member::text, true);
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 79.99);
    insert into starting_weight_checks values ('below_target_is_rejected', false);
  exception when invalid_parameter_value then
    insert into starting_weight_checks values ('below_target_is_rejected', true);
  end;
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 80.001);
    insert into starting_weight_checks values ('precision_over_two_decimals_is_rejected', false);
  exception when invalid_parameter_value then
    insert into starting_weight_checks values ('precision_over_two_decimals_is_rejected', true);
  end;
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 0);
    insert into starting_weight_checks values ('nonpositive_start_is_rejected', false);
  exception when invalid_parameter_value then
    insert into starting_weight_checks values ('nonpositive_start_is_rejected', true);
  end;
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 10000);
    insert into starting_weight_checks values ('weight_above_column_bound_is_rejected', false);
  exception when invalid_parameter_value then
    insert into starting_weight_checks values ('weight_above_column_bound_is_rejected', true);
  end;

  perform set_config('request.jwt.claim.sub', personal_other::text, true);
  begin
    perform * from public.correct_my_enrollment_starting_weight(personal_id, 130);
    insert into starting_weight_checks values ('personal_challenge_is_owner_only', false);
  exception when insufficient_privilege then
    insert into starting_weight_checks values ('personal_challenge_is_owner_only', true);
  end;
  perform set_config('request.jwt.claim.sub', outsider::text, true);
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 130);
    insert into starting_weight_checks values ('outsider_is_denied', false);
  exception when insufficient_privilege then
    insert into starting_weight_checks values ('outsider_is_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', member::text, true);
  begin
    perform * from public.correct_my_enrollment_starting_weight(other_group_id, 130);
    insert into starting_weight_checks values ('cross_group_is_denied', false);
  exception when insufficient_privilege then
    insert into starting_weight_checks values ('cross_group_is_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', withdrawn::text, true);
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 130);
    insert into starting_weight_checks values ('withdrawn_member_is_denied', false);
  exception when insufficient_privilege then
    insert into starting_weight_checks values ('withdrawn_member_is_denied', true);
  end;
  begin
    perform * from public.correct_my_enrollment_starting_weight(null, 130);
    insert into starting_weight_checks values ('null_challenge_is_denied', false);
  exception when invalid_parameter_value then
    insert into starting_weight_checks values ('null_challenge_is_denied', true);
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform * from public.correct_my_enrollment_starting_weight(group_id, 130);
    insert into starting_weight_checks values ('anonymous_execution_is_revoked', false);
  exception when insufficient_privilege then
    insert into starting_weight_checks values ('anonymous_execution_is_revoked', true);
  end;
  execute 'reset role';
end;
$$;

do $$
begin
  if exists (select 1 from starting_weight_checks where not passed) then
    raise exception 'Starting-weight correction checks failed: %',
      (select string_agg(check_name, ', ' order by check_name)
       from starting_weight_checks where not passed);
  end if;
  raise notice 'Passed % starting-weight correction checks',
    (select count(*) from starting_weight_checks);
end;
$$;
rollback;

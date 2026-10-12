-- Local-only authorization/regression coverage for Issue #257. All fixtures
-- are rolled back; execute after migrations in a disposable local database.
begin;
drop table if exists pg_temp.target_change_checks;
create temp table target_change_checks (name text primary key, passed boolean not null);
grant all on target_change_checks to authenticated;

do $$
declare
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  member_id uuid := '00000000-0000-4000-8000-000000000002';
  outsider_id uuid := '00000000-0000-4000-8000-000000000003';
  challenge_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  share_scope_id uuid := gen_random_uuid();
  starting_target_id uuid := gen_random_uuid();
  personal_id uuid := gen_random_uuid();
  member_row uuid := gen_random_uuid();
  scoped_member_row uuid := gen_random_uuid();
  starting_target_row uuid := gen_random_uuid();
  shared_entry uuid := gen_random_uuid();
  private_entry uuid := gen_random_uuid();
  result_row record;
  milestone record;
  affected integer;
  visible integer;
begin
  insert into public.profiles (id, display_name) values
    (owner_id, 'Target owner'), (member_id, 'Target member'), (outsider_id, 'Target outsider')
  on conflict (id) do nothing;
  insert into public.challenges (id, owner_id, created_by, name, start_date, end_date, status, challenge_kind) values
    (challenge_id, owner_id, owner_id, 'Target test group', current_date - 20, current_date + 20, 'active', 'group'),
    (other_id, outsider_id, outsider_id, 'Other group', current_date - 20, current_date + 20, 'active', 'group'),
    (share_scope_id, owner_id, owner_id, 'Share-scope group', current_date - 20, current_date + 20, 'active', 'group'),
    (starting_target_id, owner_id, owner_id, 'Starting target group', current_date - 20, current_date + 20, 'active', 'group'),
    (personal_id, owner_id, owner_id, 'Private challenge', current_date - 20, current_date + 20, 'active', 'personal');
  insert into public.participants (id, challenge_id, user_id, display_name, status, starting_weight_kg, target_weight_kg, joined_at) values
    (member_row, challenge_id, member_id, 'Member Alias', 'active', 100, 80, now()),
    (scoped_member_row, share_scope_id, member_id, 'Scoped Member', 'active', 100, 80, now()),
    (starting_target_row, starting_target_id, member_id, 'Starting Target Member', 'active', 90, 90, now());
  insert into public.personal_weigh_ins (id, user_id, recorded_date, weight_kg, note) values
    (shared_entry, member_id, current_date - 7, 79, 'private note must not leak'),
    (private_entry, member_id, current_date - 1, 70, 'private newer measurement');
  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id, challenge_id)
  values (shared_entry, challenge_id), (shared_entry, other_id);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into result_row from public.change_my_group_target(challenge_id, 75);
  insert into target_change_checks values ('preserves_start_and_changes_only_own_target',
    result_row.starting_weight_kg = 100 and result_row.target_weight_kg = 75
    and result_row.previous_target_weight_kg = 80 and result_row.previous_target_achieved_on = current_date - 7);
  select count(*)::integer into visible from public.get_group_target_milestones(challenge_id);
  insert into target_change_checks values ('shared_reached_milestone_visible', visible = 1);
  select * into milestone from public.get_group_target_milestones(challenge_id);
  insert into target_change_checks values ('milestone_projection_is_safe',
    milestone.display_name = 'Member Alias' and milestone.target_weight_kg = 80
    and milestone.achieved_on = current_date - 7 and milestone.state = 'reached'
    and milestone.member_key = md5(challenge_id::text || ':' || member_id::text));
  select count(*)::integer into visible from public.list_my_group_target_milestones(challenge_id);
  insert into target_change_checks values ('private_milestone_is_available_to_owner', visible = 1);

  -- Explicit share is the only group proof: private newer data is ignored.
  insert into target_change_checks values ('private_entry_did_not_change_group_evidence',
    (select achieved_on = current_date - 7 from public.get_group_target_milestones(challenge_id)));
  execute 'reset role';
  delete from public.personal_weigh_in_group_shares where personal_weigh_in_id = shared_entry;
  execute 'set local role authenticated';
  select count(*)::integer into visible from public.get_group_target_milestones(challenge_id);
  insert into target_change_checks values ('unsharing_hides_group_milestone', visible = 0);
  select count(*)::integer into visible from public.list_my_group_target_milestones(challenge_id);
  insert into target_change_checks values ('unsharing_retains_private_milestone', visible = 1);
  execute 'reset role';
  insert into public.personal_weigh_in_group_shares values (shared_entry, challenge_id, now());
  update public.personal_weigh_ins set weight_kg = 81 where id = shared_entry;
  execute 'set local role authenticated';
  select count(*)::integer into visible from public.get_group_target_milestones(challenge_id);
  insert into target_change_checks values ('correcting_source_invalidates_group_milestone', visible = 0);
  execute 'reset role';
  update public.personal_weigh_ins set weight_kg = 79 where id = shared_entry;
  delete from public.personal_weigh_ins where id = shared_entry;
  execute 'set local role authenticated';
  select count(*)::integer into visible from public.get_group_target_milestones(challenge_id);
  insert into target_change_checks values ('deleting_source_invalidates_group_milestone', visible = 0);

  -- Before reach, a valid target can be adjusted; start remains immutable.
  select * into result_row from public.change_my_group_target(challenge_id, 74.25);
  insert into target_change_checks values ('pre_reach_change_is_allowed',
    result_row.starting_weight_kg = 100 and result_row.target_weight_kg = 74.25
    and result_row.previous_target_weight_kg is null);
  begin
    perform * from public.change_my_group_target(challenge_id, 100);
    insert into target_change_checks values ('target_must_be_below_start', false);
  exception when invalid_parameter_value then
    insert into target_change_checks values ('target_must_be_below_start', true);
  end;
  begin
    perform * from public.change_my_group_target(challenge_id, 74.251);
    insert into target_change_checks values ('target_has_two_decimal_precision', false);
  exception when invalid_parameter_value then
    insert into target_change_checks values ('target_has_two_decimal_precision', true);
  end;
  begin
    perform * from public.change_my_group_target(challenge_id, 0);
    insert into target_change_checks values ('target_must_be_positive', false);
  exception when invalid_parameter_value then
    insert into target_change_checks values ('target_must_be_positive', true);
  end;
  execute 'reset role';
  insert into public.personal_weigh_in_group_shares values (private_entry, challenge_id, now());
  execute 'set local role authenticated';
  select * into result_row from public.change_my_group_target(challenge_id, 73.5);
  insert into target_change_checks values ('reached_target_can_only_move_lower',
    result_row.previous_target_weight_kg = 74.25
    and result_row.previous_target_achieved_on = current_date - 1
    and result_row.target_weight_kg = 73.5);
  begin
    perform * from public.change_my_group_target(challenge_id, 74.25);
    insert into target_change_checks values ('cannot_keep_or_raise_a_reached_target', false);
  exception when invalid_parameter_value then
    insert into target_change_checks values ('cannot_keep_or_raise_a_reached_target', true);
  end;

  -- Sharing the same personal measurement elsewhere does not prove that this
  -- challenge's target has been reached.
  select * into result_row from public.change_my_group_target(share_scope_id, 75);
  insert into target_change_checks values ('reach_evidence_is_challenge_scoped',
    result_row.previous_target_weight_kg is null and result_row.target_weight_kg = 75);

  -- Starting at the target is immediately reached, without inventing a date.
  select * into result_row from public.change_my_group_target(starting_target_id, 80);
  insert into target_change_checks values ('starting_at_target_can_choose_lower',
    result_row.previous_target_weight_kg = 90 and result_row.previous_target_achieved_on is null
    and result_row.target_weight_kg = 80);
  select count(*)::integer into visible from public.list_my_group_target_milestones(starting_target_id)
  where achieved_on is null and target_weight_kg = 90;
  insert into target_change_checks values ('starting_target_milestone_has_no_fabricated_date', visible = 1);
  select count(*)::integer into visible from public.get_group_target_milestones(starting_target_id);
  insert into target_change_checks values ('undocumented_starting_target_is_private', visible = 0);

  -- Direct participant UPDATE stays owner-only; RPC is self-scoped.
  update public.participants set target_weight_kg = 60 where id = member_row;
  get diagnostics affected = row_count;
  insert into target_change_checks values ('participant_cannot_directly_update_self', affected = 0);
  begin
    select count(*) into visible from public.participant_target_milestones;
    insert into target_change_checks values ('milestone_table_is_not_client_readable', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('milestone_table_is_not_client_readable', true);
  end;
  begin
    perform * from public.change_my_group_target(other_id, 70);
    insert into target_change_checks values ('cross_group_mutation_denied', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('cross_group_mutation_denied', true);
  end;
  begin
    perform * from public.change_my_group_target(personal_id, 70);
    insert into target_change_checks values ('personal_challenge_mutation_denied', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('personal_challenge_mutation_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.change_my_group_target(challenge_id, 70);
    insert into target_change_checks values ('outsider_mutation_denied', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('outsider_mutation_denied', true);
  end;
  begin
    perform * from public.get_group_target_milestones(challenge_id);
    insert into target_change_checks values ('outsider_milestone_read_denied', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('outsider_milestone_read_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.change_my_group_target(challenge_id, 70);
    insert into target_change_checks values ('anonymous_mutation_denied', false);
  exception when insufficient_privilege then
    insert into target_change_checks values ('anonymous_mutation_denied', true);
  end;
end;
$$;

select name, passed from target_change_checks order by name;
do $$ begin
  if exists (select 1 from target_change_checks where not passed)
     or (select count(*) from target_change_checks) <> 26 then
    raise exception 'Target-change authorization regression failed.';
  end if;
end $$;
rollback;

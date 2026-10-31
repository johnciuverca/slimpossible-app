-- Local-only authorization/regression coverage for Issue #256. All fixtures
-- roll back; execute after migrations in a disposable local PostgreSQL DB.
begin;
create temp table group_member_projection_checks (
  check_name text primary key,
  passed boolean not null
);
grant all on group_member_projection_checks to authenticated;

do $$
declare
  owner_id uuid := '00000000-0000-4000-8000-000000000001';
  member_id uuid := '00000000-0000-4000-8000-000000000002';
  outsider_id uuid := '00000000-0000-4000-8000-000000000003';
  peer_id uuid := '00000000-0000-4000-8000-000000000004';
  withdrawn_id uuid := '00000000-0000-4000-8000-000000000005';
  equal_id uuid := '00000000-0000-4000-8000-000000000006';
  invalid_id uuid := '00000000-0000-4000-8000-000000000007';
  missing_id uuid := '00000000-0000-4000-8000-000000000008';
  rounded_id uuid := '00000000-0000-4000-8000-000000000009';
  negative_id uuid := '00000000-0000-4000-8000-000000000010';
  capped_id uuid := '00000000-0000-4000-8000-000000000011';
  group_id uuid := gen_random_uuid();
  other_group_id uuid := gen_random_uuid();
  personal_id uuid := gen_random_uuid();
  member_participant_id uuid := gen_random_uuid();
  prejoin_id uuid := gen_random_uuid();
  reached_id uuid := gen_random_uuid();
  current_id uuid := gen_random_uuid();
  private_id uuid := gen_random_uuid();
  future_id uuid := gen_random_uuid();
  other_scope_id uuid := gen_random_uuid();
  intermediate_id uuid := gen_random_uuid();
  peer_entry_id uuid := gen_random_uuid();
  withdrawn_entry_id uuid := gen_random_uuid();
  invalid_entry_id uuid := gen_random_uuid();
  missing_prejoin_id uuid := gen_random_uuid();
  rounded_entry_id uuid := gen_random_uuid();
  negative_entry_id uuid := gen_random_uuid();
  capped_entry_id uuid := gen_random_uuid();
  member_row record;
  peer_row record;
  equal_row record;
  invalid_row record;
  missing_row record;
  rounded_row record;
  negative_row record;
  capped_row record;
  row_json jsonb;
  visible integer;
begin
  insert into auth.users (id) values
    (peer_id), (withdrawn_id), (equal_id), (invalid_id), (missing_id), (rounded_id),
    (negative_id), (capped_id)
  on conflict (id) do nothing;
  insert into public.profiles (id, display_name) values
    (owner_id, 'Projection owner'), (member_id, 'Projection member'),
    (outsider_id, 'Projection outsider'), (peer_id, 'Projection peer'),
    (withdrawn_id, 'Withdrawn projection member'),
    (equal_id, 'Equal target member'), (invalid_id, 'Invalid target member'),
    (missing_id, 'No entry member'), (rounded_id, 'Rounded progress member'),
    (negative_id, 'Negative progress member'), (capped_id, 'Capped progress member')
  on conflict (id) do nothing;

  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (group_id, owner_id, owner_id, 'Projection group', current_date - 30, current_date + 30, 'active', 'group'),
    (other_group_id, outsider_id, outsider_id, 'Other projection group', current_date - 30, current_date + 30, 'active', 'group'),
    (personal_id, owner_id, owner_id, 'Personal projection challenge', current_date - 30, current_date + 30, 'active', 'personal');

  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (member_participant_id, group_id, member_id, 'Projection member', 'active', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, peer_id, 'Projection peer', 'active', 200, 100, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, equal_id, 'Equal target member', 'active', 70, 70, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, invalid_id, 'Invalid target member', 'active', 100, 110, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, missing_id, 'No entry member', 'active', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, rounded_id, 'Rounded progress member', 'active', 100, 70, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, negative_id, 'Negative progress member', 'active', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, capped_id, 'Capped progress member', 'active', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), group_id, withdrawn_id, 'Withdrawn projection member', 'withdrawn', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), other_group_id, outsider_id, 'Projection outsider', 'active', 100, 80, ((current_date - 5)::timestamp at time zone 'UTC')),
    (gen_random_uuid(), personal_id, equal_id, 'Personal member', 'active', 100, 90, ((current_date - 5)::timestamp at time zone 'UTC'));

  insert into public.personal_weigh_ins (id, user_id, recorded_date, weight_kg, note) values
    (prejoin_id, member_id, current_date - 6, 50, 'pre-enrollment shared note'),
    (reached_id, member_id, current_date - 4, 90, 'private milestone evidence note'),
    (intermediate_id, member_id, current_date - 2, 85, 'intermediate private note'),
    (current_id, member_id, current_date - 1, 75, 'latest shared private note'),
    (private_id, member_id, current_date, 30, 'newer unshared private note'),
    (future_id, member_id, current_date + 1, 1, 'future private note'),
    (other_scope_id, member_id, current_date - 3, 60, 'other challenge private note'),
    (peer_entry_id, peer_id, current_date - 2, 150, 'peer private note'),
    (withdrawn_entry_id, withdrawn_id, current_date - 1, 70, 'withdrawn private note'),
    (invalid_entry_id, invalid_id, current_date - 1, 90, 'invalid-target private note'),
    (negative_entry_id, negative_id, current_date - 1, 105, 'negative progress private note'),
    (capped_entry_id, capped_id, current_date - 1, 130, 'capped progress private note');
  insert into public.personal_weigh_ins (id, user_id, recorded_date, weight_kg, note) values
    (missing_prejoin_id, missing_id, current_date - 6, 50, 'pre-enrollment only entry'),
    (rounded_entry_id, rounded_id, current_date - 1, 84.98, 'rounding fixture note');

  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id, challenge_id) values
    (prejoin_id, group_id), (reached_id, group_id), (intermediate_id, group_id),
    (current_id, group_id),
    (future_id, group_id), (other_scope_id, other_group_id),
    (private_id, other_group_id),
    (peer_entry_id, group_id), (withdrawn_entry_id, group_id),
    (invalid_entry_id, group_id), (missing_prejoin_id, group_id),
    (rounded_entry_id, group_id), (negative_entry_id, group_id),
    (capped_entry_id, group_id);
  insert into public.participant_target_milestones (
    challenge_id, participant_id, target_weight_kg, achieved_on
  ) values
    (group_id, member_participant_id, 90, current_date - 4),
    (group_id, member_participant_id, 75, current_date - 1),
    (group_id, member_participant_id, 60, current_date - 6);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into member_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || member_id::text);
  insert into group_member_projection_checks values
    ('active_member_gets_own_group_projection',
      member_row.member_key = md5(group_id::text || ':' || member_id::text)
      and member_row.display_name = 'Projection member');
  insert into group_member_projection_checks values
    ('latest_shared_nonfuture_entry_wins', member_row.latest_recorded_date = current_date - 1
      and member_row.completion_percentage = 100
      and member_row.signed_display_percentage = 100
      and not member_row.negative_progress_capped
      and member_row.progress_state = 'reached');
  select to_jsonb(member_row) into row_json;
  insert into group_member_projection_checks values
    ('projection_excludes_weights_notes_and_raw_ids',
      not row_json ? 'weight_kg' and not row_json ? 'note'
      and not row_json ? 'user_id' and not row_json ? 'participant_id'
      and not row_json ? 'email' and not row_json ? 'id');
  insert into group_member_projection_checks values
    ('milestones_contain_only_shared_achievements',
      jsonb_array_length(member_row.reached_target_milestones) = 2
      and member_row.reached_target_milestones @> jsonb_build_array(
        jsonb_build_object('target_weight_kg', 90, 'achieved_on', (current_date - 4)::text, 'state', 'reached'))
      and member_row.reached_target_milestones @> jsonb_build_array(
        jsonb_build_object('target_weight_kg', 75, 'achieved_on', (current_date - 1)::text, 'state', 'reached'))
      and not member_row.reached_target_milestones @> jsonb_build_array(
        jsonb_build_object('target_weight_kg', 60, 'achieved_on', (current_date - 6)::text, 'state', 'reached')));
  select * into peer_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || peer_id::text);
  insert into group_member_projection_checks values
    ('peer_midpoint_uses_clamped_loss_formula',
      peer_row.completion_percentage = 50.0 and peer_row.progress_state = 'in_progress');
  select * into negative_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || negative_id::text);
  insert into group_member_projection_checks values
    ('above_start_displays_signed_progress_without_changing_clamped_value',
      negative_row.completion_percentage = 0
      and negative_row.signed_display_percentage = -25
      and not negative_row.negative_progress_capped
      and negative_row.progress_state = 'in_progress');
  select * into capped_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || capped_id::text);
  insert into group_member_projection_checks values
    ('larger_gain_caps_signed_display_at_minus_100',
      capped_row.completion_percentage = 0
      and capped_row.signed_display_percentage = -100
      and capped_row.negative_progress_capped
      and capped_row.progress_state = 'in_progress');
  select * into rounded_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || rounded_id::text);
  insert into group_member_projection_checks values
    ('percentage_is_rounded_to_one_decimal', rounded_row.completion_percentage = 50.1);
  execute 'reset role';
  update public.personal_weigh_ins set weight_kg = 300 where id = peer_entry_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  insert into group_member_projection_checks values
    ('gain_above_start_clamps_to_zero',
      (select completion_percentage = 0
        and signed_display_percentage = -100
        and not negative_progress_capped
        and progress_state = 'in_progress'
        from public.get_group_member_progress(group_id)
        where member_key = md5(group_id::text || ':' || peer_id::text)));
  select * into equal_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || equal_id::text);
  insert into group_member_projection_checks values
    ('equal_start_and_target_is_reached_without_fabricated_date',
      equal_row.latest_recorded_date is null and equal_row.completion_percentage = 100
      and equal_row.signed_display_percentage = 100
      and equal_row.progress_state = 'reached');
  select * into invalid_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || invalid_id::text);
  insert into group_member_projection_checks values
    ('target_above_start_is_unavailable',
      invalid_row.completion_percentage is null
      and invalid_row.signed_display_percentage is null
      and not invalid_row.negative_progress_capped
      and invalid_row.progress_state = 'unavailable');
  select * into missing_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || missing_id::text);
  insert into group_member_projection_checks values
    ('missing_shared_current_entry_is_unavailable',
      missing_row.latest_recorded_date is null and missing_row.completion_percentage is null
      and missing_row.signed_display_percentage is null
      and not missing_row.negative_progress_capped
      and missing_row.progress_state = 'unavailable');
  insert into group_member_projection_checks values
    ('withdrawn_member_is_not_in_projection', not exists (
      select 1 from public.get_group_member_progress(group_id)
      where member_key = md5(group_id::text || ':' || withdrawn_id::text)));
  insert into group_member_projection_checks values
    ('projection_contains_only_selected_group_members',
      (select count(*) = 8 from public.get_group_member_progress(group_id))
      and not exists (select 1 from public.get_group_member_progress(group_id)
        where member_key = md5(other_group_id::text || ':' || outsider_id::text)));

  -- Owner access matches the existing Group contract even without enrollment.
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*) into visible from public.get_group_member_progress(group_id);
  insert into group_member_projection_checks values ('challenge_owner_can_read_group_projection', visible = 8);

  -- Unsharing the latest proof refreshes both the current projection and milestones.
  execute 'reset role';
  delete from public.personal_weigh_in_group_shares
    where personal_weigh_in_id = current_id and challenge_id = group_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into member_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || member_id::text);
  insert into group_member_projection_checks values
    ('unshare_refreshes_latest_date_and_progress',
      member_row.latest_recorded_date = current_date - 2
      and member_row.completion_percentage = 75 and member_row.progress_state = 'in_progress');
  insert into group_member_projection_checks values
    ('unshare_hides_milestone_without_qualifying_proof',
      jsonb_array_length(member_row.reached_target_milestones) = 1
      and member_row.reached_target_milestones @> jsonb_build_array(
        jsonb_build_object('target_weight_kg', 90, 'achieved_on', (current_date - 4)::text, 'state', 'reached')));

  execute 'reset role';
  update public.personal_weigh_ins set weight_kg = 95 where id in (intermediate_id, reached_id);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into member_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || member_id::text);
  insert into group_member_projection_checks values
    ('corrected_shared_evidence_recomputes_progress_and_milestones',
      member_row.latest_recorded_date = current_date - 2
      and member_row.completion_percentage = 25
      and jsonb_array_length(member_row.reached_target_milestones) = 0);
  execute 'reset role';
  delete from public.personal_weigh_ins where id = intermediate_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into member_row from public.get_group_member_progress(group_id)
    where member_key = md5(group_id::text || ':' || member_id::text);
  insert into group_member_projection_checks values
    ('delete_refreshes_current_entry_date',
      member_row.latest_recorded_date = current_date - 4
      and member_row.completion_percentage = 25);

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_member_progress(group_id);
    insert into group_member_projection_checks values ('outsider_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('outsider_is_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', withdrawn_id::text, true);
  begin
    perform * from public.get_group_member_progress(group_id);
    insert into group_member_projection_checks values ('withdrawn_viewer_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('withdrawn_viewer_is_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', equal_id::text, true);
  begin
    perform * from public.get_group_member_progress(personal_id);
    insert into group_member_projection_checks values ('personal_challenge_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('personal_challenge_is_denied', true);
  end;
  begin
    perform * from public.get_group_member_progress(null);
    insert into group_member_projection_checks values ('null_challenge_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('null_challenge_is_denied', true);
  end;
  begin
    perform * from public.get_group_member_progress(gen_random_uuid());
    insert into group_member_projection_checks values ('unknown_challenge_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('unknown_challenge_is_denied', true);
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.get_group_member_progress(group_id);
    insert into group_member_projection_checks values ('sessionless_authenticated_is_denied', false);
  exception when insufficient_privilege then
    insert into group_member_projection_checks values ('sessionless_authenticated_is_denied', true);
  end;
  execute 'set local role anon';
  begin
    perform * from public.get_group_member_progress(group_id);
    raise exception 'Anonymous access was allowed.';
  exception when insufficient_privilege then
    execute 'reset role';
    insert into group_member_projection_checks values ('anonymous_is_denied', true);
  when raise_exception then
    execute 'reset role';
    insert into group_member_projection_checks values ('anonymous_is_denied', false);
  end;

  execute 'reset role';
  if exists (select 1 from group_member_projection_checks where passed is distinct from true) then
    raise exception 'Group member projection checks failed: %',
      (select string_agg(check_name, ', ' order by check_name)
        from group_member_projection_checks where passed is distinct from true);
  end if;
end;
$$;

select check_name, passed from group_member_projection_checks order by check_name;
rollback;

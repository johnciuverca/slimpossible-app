-- Rollback-only authorization contract for #210. Use only owner-approved,
-- disposable non-production Auth users. Never replace the placeholders by
-- inference or run this against production.
begin;

select set_config('slimpossible.personal_owner_id', 'REPLACE_OWNER_UUID', true);
select set_config('slimpossible.personal_member_id', 'REPLACE_MEMBER_UUID', true);
select set_config('slimpossible.personal_outsider_id', 'REPLACE_OUTSIDER_UUID', true);

create temp table slimpossible_personal_weigh_in_results (
  check_name text primary key,
  passed boolean not null
);
grant all on slimpossible_personal_weigh_in_results to authenticated, anon;

do $$
declare
  owner_id uuid := current_setting('slimpossible.personal_owner_id')::uuid;
  member_id uuid := current_setting('slimpossible.personal_member_id')::uuid;
  outsider_id uuid := current_setting('slimpossible.personal_outsider_id')::uuid;
  group_one uuid := gen_random_uuid();
  group_two uuid := gen_random_uuid();
  outsider_group uuid := gen_random_uuid();
  member_one_participant uuid := gen_random_uuid();
  member_two_participant uuid := gen_random_uuid();
  outsider_participant uuid := gen_random_uuid();
  first_entry uuid;
  second_entry uuid;
  correction_entry uuid;
  protected_entry uuid;
  past_summary_entry uuid;
  previous_summary_entry uuid;
  after_sunday_entry uuid;
  future_summary_entry uuid;
  current_sunday date := current_date - extract(dow from current_date)::integer;
  comparison_sunday date := current_sunday - 28;
  eligible_count bigint;
  winner_count bigint;
  reached_count bigint;
  recorded_count bigint;
  row_count integer;
  numeric_summary numeric;
  date_summary date;
  projection jsonb;
begin
  if owner_id = member_id or owner_id = outsider_id or member_id = outsider_id then
    raise exception 'Approved owner/member/outsider identities must be distinct.';
  end if;
  select count(*)::integer into row_count from auth.users
  where id in (owner_id, member_id, outsider_id);
  if row_count <> 3 then
    raise exception 'All three approved disposable Auth users must exist.';
  end if;

  insert into public.profiles (id, display_name)
  values (owner_id, '[16.3 test] owner'),
    (member_id, '[16.3 test] member'),
    (outsider_id, '[16.3 test] outsider')
  on conflict (id) do nothing;
  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (group_one, owner_id, owner_id, '[16.3 test] group one', current_date - 30, current_date + 30, 'active', 'group'),
    (group_two, owner_id, owner_id, '[16.3 test] group two', current_date - 30, current_date + 30, 'active', 'group'),
    (outsider_group, outsider_id, outsider_id, '[16.3 test] outsider group', current_date - 30, current_date + 30, 'active', 'group');
  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (member_one_participant, group_one, member_id, '[16.3 test] member', 'active', 90, 80, now()),
    (member_two_participant, group_two, member_id, '[16.3 test] member', 'active', 90, 80, now()),
    (outsider_participant, outsider_group, outsider_id, '[16.3 test] outsider', 'active', 90, 80, now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select id into first_entry from public.save_personal_weigh_in(
    null, current_date - 14, 90, '[16.3 private] never returned to groups',
    array[group_one, group_two]
  );
  insert into slimpossible_personal_weigh_in_results values
    ('one_entry_can_be_shared_to_multiple_groups', first_entry is not null);
  select count(*)::integer into row_count from public.personal_weigh_ins
  where user_id = member_id and recorded_date = current_date - 14;
  insert into slimpossible_personal_weigh_in_results values
    ('one_canonical_user_date_row', row_count = 1);
  select count(*)::integer into row_count from public.list_my_personal_weigh_ins()
  where id = first_entry and note = '[16.3 private] never returned to groups';
  insert into slimpossible_personal_weigh_in_results values
    ('owner_can_read_own_private_note', row_count = 1);

  select id into second_entry from public.save_personal_weigh_in(
    null, current_date - 21, 91, null, '{}'::uuid[]
  );
  select id into correction_entry from public.save_personal_weigh_in(
    null, current_date - 21, 90.5, null, '{}'::uuid[]
  );
  select count(*)::integer into row_count from public.personal_weigh_ins
  where user_id = member_id and recorded_date = current_date - 21
    and weight_kg = 90.5;
  insert into slimpossible_personal_weigh_in_results values
    ('same_day_correction_updates_the_one_canonical_entry',
      row_count = 1 and correction_entry = second_entry);

  begin
    perform * from public.save_personal_weigh_in(
      first_entry, current_date - 21, 90, null, array[group_one, group_two]
    );
    insert into slimpossible_personal_weigh_in_results values
      ('date_edit_conflict_does_not_merge_rows', false);
  exception when unique_violation then
    insert into slimpossible_personal_weigh_in_results values
      ('date_edit_conflict_does_not_merge_rows', true);
  end;

  select to_jsonb(history) into projection
  from public.get_group_weigh_in_history(group_one) history limit 1;
  insert into slimpossible_personal_weigh_in_results values
    ('group_projection_omits_note_and_user_id',
      projection is not null and not (projection ? 'note') and not (projection ? 'user_id'));

  begin
    perform * from public.save_personal_weigh_in(
      null, current_date - 13, 89, 'private', array[outsider_group]
    );
    insert into slimpossible_personal_weigh_in_results values
      ('cross_group_share_denied_atomically', false);
  exception when insufficient_privilege then
    select count(*)::integer into row_count from public.personal_weigh_ins
    where user_id = member_id and recorded_date = current_date - 13;
    insert into slimpossible_personal_weigh_in_results values
      ('cross_group_share_denied_atomically', row_count = 0);
  end;

  -- Unsharing from one group leaves the other explicit share in place.
  perform * from public.save_personal_weigh_in(
    first_entry, current_date - 14, 90, '[16.3 private] never returned to groups',
    array[group_two]
  );
  select count(*)::integer into row_count
  from public.get_group_weigh_in_history(group_one);
  insert into slimpossible_personal_weigh_in_results values
    ('unsharing_removes_only_selected_group', row_count = 0);
  select count(*)::integer into row_count
  from public.get_group_weigh_in_history(group_two);
  insert into slimpossible_personal_weigh_in_results values
    ('remaining_group_share_is_preserved', row_count = 1);

  -- Simulate copied legacy data. Current goal completion uses the latest
  -- nonfuture share; Sunday winners use only the exact comparison dates.
  execute 'reset role';
  insert into public.personal_weigh_ins (
    user_id, recorded_date, weight_kg, note
  ) values
    (member_id, comparison_sunday - 7, 92, 'previous Sunday fixture'),
    (member_id, comparison_sunday, 90, 'Sunday summary fixture'),
    (member_id, comparison_sunday + 1, 80, 'weekday reached-target fixture'),
    (member_id, current_date + 1, 95, 'future summary fixture');
  select id into previous_summary_entry from public.personal_weigh_ins
  where user_id = member_id and recorded_date = comparison_sunday - 7;
  select id into past_summary_entry from public.personal_weigh_ins
  where user_id = member_id and recorded_date = comparison_sunday;
  select id into after_sunday_entry from public.personal_weigh_ins
  where user_id = member_id and recorded_date = comparison_sunday + 1;
  select id into future_summary_entry from public.personal_weigh_ins
  where user_id = member_id and recorded_date = current_date + 1;
  insert into public.personal_weigh_in_group_shares (
    personal_weigh_in_id, challenge_id
  ) values
    (previous_summary_entry, group_one),
    (past_summary_entry, group_one),
    (future_summary_entry, group_one);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select summary.average_completion_percentage, summary.eligible_participant_count,
    summary.weekly_winner_count, summary.reached_target_count
    into numeric_summary, eligible_count, winner_count, reached_count
  from public.get_group_progress_summary(group_one, comparison_sunday) summary;
  insert into slimpossible_personal_weigh_in_results values
    ('future_share_does_not_change_current_completion',
      numeric_summary = 0 and eligible_count = 1 and winner_count = 1 and reached_count = 0);
  execute 'reset role';
  insert into public.personal_weigh_in_group_shares (
    personal_weigh_in_id, challenge_id
  ) values (after_sunday_entry, group_one);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select summary.average_completion_percentage, summary.eligible_participant_count,
    summary.weekly_winner_count, summary.reached_target_count,
    summary.participants_with_recorded_weight_count
    into numeric_summary, eligible_count, winner_count, reached_count, recorded_count
  from public.get_group_progress_summary(group_one, comparison_sunday) summary;
  insert into slimpossible_personal_weigh_in_results values
    ('weekday_share_updates_completion_without_changing_sunday_winners',
      numeric_summary = 100 and reached_count = 1 and recorded_count = 1
      and eligible_count = 1 and winner_count = 1);
  begin
    perform * from public.get_group_progress_summary(group_one, current_sunday + 7);
    insert into slimpossible_personal_weigh_in_results values
      ('future_sunday_summary_rejected', false);
  exception when invalid_parameter_value then
    insert into slimpossible_personal_weigh_in_results values
      ('future_sunday_summary_rejected', true);
  end;
  begin
    perform * from public.get_provisional_group_leader_summary(group_one, current_date + 1);
    insert into slimpossible_personal_weigh_in_results values
      ('future_provisional_summary_date_rejected', false);
  exception when invalid_parameter_value then
    insert into slimpossible_personal_weigh_in_results values
      ('future_provisional_summary_date_rejected', true);
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select summary.total_weigh_in_count, summary.latest_recorded_date
    into row_count, date_summary
  from public.get_challenge_progress_summary(group_one) summary;
  insert into slimpossible_personal_weigh_in_results values
    ('owner_challenge_summary_excludes_future_copied_row',
      row_count = 3 and date_summary = comparison_sunday + 1);
  perform set_config('request.jwt.claim.sub', member_id::text, true);

  begin
    perform count(*) from public.personal_weigh_in_group_shares;
    insert into slimpossible_personal_weigh_in_results values
      ('member_cannot_read_raw_share_rows', false);
  exception when insufficient_privilege then
    insert into slimpossible_personal_weigh_in_results values
      ('member_cannot_read_raw_share_rows', true);
  end;

  -- A withdrawn member must lose group-history access even though their
  -- personal entries and prior explicit shares remain stored.
  execute 'reset role';
  update public.participants set status = 'withdrawn'
  where id = member_two_participant;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(group_two);
    insert into slimpossible_personal_weigh_in_results values
      ('withdrawn_member_cannot_read_group_history', false);
  exception when insufficient_privilege then
    insert into slimpossible_personal_weigh_in_results values
      ('withdrawn_member_cannot_read_group_history', true);
  end;
  execute 'reset role';
  update public.participants set status = 'active'
  where id = member_two_participant;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);

  select id into protected_entry from public.save_personal_weigh_in(
    null, current_date - 3, 88, '[16.3 private] owned entry', array[group_two]
  );

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(group_one);
    insert into slimpossible_personal_weigh_in_results values ('outsider_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_personal_weigh_in_results values ('outsider_denied', true);
  end;

  execute 'reset role';
  execute 'set local role anon';
  begin
    perform * from public.list_my_personal_weigh_ins();
    insert into slimpossible_personal_weigh_in_results values
      ('anonymous_cannot_call_personal_list', false);
  exception when insufficient_privilege then
    insert into slimpossible_personal_weigh_in_results values
      ('anonymous_cannot_call_personal_list', true);
  end;
  begin
    perform count(*) from public.personal_weigh_in_group_shares;
    insert into slimpossible_personal_weigh_in_results values
      ('anonymous_cannot_read_raw_share_rows', false);
  exception when insufficient_privilege then
    insert into slimpossible_personal_weigh_in_results values
      ('anonymous_cannot_read_raw_share_rows', true);
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  if public.delete_personal_weigh_in(first_entry) then
    insert into slimpossible_personal_weigh_in_results values ('owner_delete_succeeds', true);
  else
    insert into slimpossible_personal_weigh_in_results values ('owner_delete_succeeds', false);
  end if;
  execute 'reset role';
  select count(*)::integer into row_count from public.personal_weigh_in_group_shares
  where personal_weigh_in_id = first_entry;
  insert into slimpossible_personal_weigh_in_results values
    ('delete_cascades_group_shares', row_count = 0);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if public.delete_personal_weigh_in(protected_entry) then
    insert into slimpossible_personal_weigh_in_results values ('other_user_delete_denied', false);
  else
    insert into slimpossible_personal_weigh_in_results values ('other_user_delete_denied', true);
  end if;
  select count(*)::integer into row_count from public.list_my_personal_weigh_ins()
  where id = protected_entry and note = '[16.3 private] owned entry';
  insert into slimpossible_personal_weigh_in_results values
    ('other_user_cannot_read_private_note', row_count = 0);
  execute 'reset role';
  select count(*)::integer into row_count from public.personal_weigh_ins
  where id = protected_entry and user_id = member_id
    and note = '[16.3 private] owned entry';
  insert into slimpossible_personal_weigh_in_results values
    ('unauthorized_delete_leaves_live_entry_intact', row_count = 1);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  if public.delete_personal_weigh_in(protected_entry) then
    insert into slimpossible_personal_weigh_in_results values
      ('owner_can_delete_after_denied_attempt', true);
  else
    insert into slimpossible_personal_weigh_in_results values
      ('owner_can_delete_after_denied_attempt', false);
  end if;

  execute 'reset role';
end;
$$;

select check_name, passed from slimpossible_personal_weigh_in_results order by check_name;

do $$
begin
  if (select count(*) from slimpossible_personal_weigh_in_results) <> 25
     or exists (select 1 from slimpossible_personal_weigh_in_results where not passed) then
    raise exception 'Personal weigh-in authorization checks failed; roll back this batch.';
  end if;
end;
$$;

rollback;

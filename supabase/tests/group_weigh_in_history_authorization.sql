-- Local/non-production authorization test for opt-in group weigh-in history.
-- Requires four disposable auth.users ordered by created_at: owner, active
-- member, withdrawn member, outsider. Fixture rows are rolled back.

begin;

drop table if exists pg_temp.slimpossible_group_weigh_in_checks;
create temp table slimpossible_group_weigh_in_checks (
  check_name text primary key,
  passed boolean not null
);
grant all on table slimpossible_group_weigh_in_checks to authenticated, anon;

do $$
declare
  test_user_count integer;
  owner_id uuid;
  member_id uuid;
  withdrawn_id uuid;
  outsider_id uuid;
  test_challenge_id uuid := gen_random_uuid();
  other_challenge_id uuid := gen_random_uuid();
  personal_challenge_id uuid := gen_random_uuid();
  member_participant_id uuid := gen_random_uuid();
  withdrawn_participant_id uuid := gen_random_uuid();
  outsider_participant_id uuid := gen_random_uuid();
  entry_count integer;
  summary jsonb;
  raw_count integer;
begin
  select count(*)::integer into test_user_count from auth.users;
  if test_user_count <> 4 then
    raise exception 'Expected exactly four disposable test users; found %.', test_user_count;
  end if;

  select
    (max(id::text) filter (where user_order = 1))::uuid,
    (max(id::text) filter (where user_order = 2))::uuid,
    (max(id::text) filter (where user_order = 3))::uuid,
    (max(id::text) filter (where user_order = 4))::uuid
    into owner_id, member_id, withdrawn_id, outsider_id
  from (
    select id, row_number() over (order by created_at) as user_order
    from auth.users
  ) as ordered_users;

  insert into public.profiles (id, display_name)
  values
    (owner_id, 'History test owner'),
    (member_id, 'History test member'),
    (withdrawn_id, 'History test withdrawn'),
    (outsider_id, 'History test outsider')
  on conflict (id) do nothing;

  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values
    (test_challenge_id, owner_id, owner_id, 'History test group', current_date - 30, current_date + 30, 'active', 'group'),
    (other_challenge_id, outsider_id, outsider_id, 'Other group', current_date - 30, current_date + 30, 'active', 'group'),
    (personal_challenge_id, owner_id, owner_id, 'Private owner challenge', current_date - 30, current_date + 30, 'active', 'personal');

  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (member_participant_id, test_challenge_id, member_id, 'Visible Member', 'active', 100, 80, now()),
    (withdrawn_participant_id, test_challenge_id, withdrawn_id, 'Withdrawn Member', 'withdrawn', 90, 75, now()),
    (outsider_participant_id, other_challenge_id, outsider_id, 'Other Challenge', 'active', 90, 75, now());

  -- The older private entry must not become the shared-history delta baseline.
  -- Only the next two entries are explicitly shared to this group; the future
  -- entry is shared too, but is not yet visible. These are canonical personal
  -- weigh-ins and challenge-specific share rows, matching the current RPC.
  insert into public.personal_weigh_ins (user_id, recorded_date, weight_kg, note)
  values
    (member_id, current_date - 21, 102, 'historical private note'),
    (member_id, current_date - 14, 100, 'private first note'),
    (member_id, current_date - 7, 98.5, 'private correction note'),
    (member_id, current_date + 1, 97, 'future private note'),
    (withdrawn_id, current_date - 7, 75, 'withdrawn private note'),
    (outsider_id, current_date - 7, 85, 'other challenge private note');
  insert into public.personal_weigh_in_group_shares (
    personal_weigh_in_id, challenge_id
  )
  select personal.id, selected.challenge_id
  from public.personal_weigh_ins as personal
  join (values
    (member_id, current_date - 14, test_challenge_id),
    (member_id, current_date - 7, test_challenge_id),
    (member_id, current_date + 1, test_challenge_id),
    (withdrawn_id, current_date - 7, test_challenge_id),
    (outsider_id, current_date - 7, other_challenge_id)
  ) as selected(user_id, recorded_date, challenge_id)
    on selected.user_id = personal.user_id
   and selected.recorded_date = personal.recorded_date;

  execute 'set local role authenticated';
  execute 'set local role anon';
  begin
    perform * from public.get_group_weigh_in_history(test_challenge_id);
    insert into slimpossible_group_weigh_in_checks values ('anonymous_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_weigh_in_checks values ('anonymous_denied', true);
  end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into entry_count
  from public.get_group_weigh_in_history(test_challenge_id);
  select to_jsonb(history) into summary
  from public.get_group_weigh_in_history(test_challenge_id) as history
  order by history.recorded_date desc limit 1;
  if summary is null then
    raise exception 'Fixture returned no shared history row; delta assertion cannot be evaluated.';
  end if;
  insert into slimpossible_group_weigh_in_checks values
    ('active_member_sees_only_opted_in_past_records', entry_count = 2);
  insert into slimpossible_group_weigh_in_checks values
    ('safe_delta_uses_prior_shared_row_only',
      summary -> 'change_since_previous_kg' = '-1.5'::jsonb
      and summary ->> 'display_name' = 'Visible Member'
      and not (summary ? 'note')
      and not (summary ? 'participant_id')
      and not (summary ? 'user_id')
      and not (summary ? 'email'));
  insert into slimpossible_group_weigh_in_checks values
    ('private_prior_row_is_not_exposed_or_used_as_delta_baseline',
      not exists (
        select 1 from public.get_group_weigh_in_history(test_challenge_id)
        where recorded_date = current_date - 21
      ) and summary -> 'change_since_previous_kg' = '-1.5'::jsonb);
  select count(*)::integer into raw_count
  from public.personal_weigh_ins
  where user_id = withdrawn_id;
  insert into slimpossible_group_weigh_in_checks values
    ('raw_table_hides_other_members_rows', raw_count = 0);

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*)::integer into entry_count
  from public.get_group_weigh_in_history(test_challenge_id);
  insert into slimpossible_group_weigh_in_checks values
    ('challenge_owner_can_read_shared_history', entry_count = 2);
  select count(*)::integer into raw_count
  from public.personal_weigh_ins
  where user_id in (
    select participant.user_id
    from public.participants as participant
    where participant.challenge_id = test_challenge_id
  );
  insert into slimpossible_group_weigh_in_checks values
    ('owner_cannot_read_raw_member_rows', raw_count = 0);
  begin
    perform * from public.get_group_weigh_in_history(personal_challenge_id);
    insert into slimpossible_group_weigh_in_checks values ('personal_challenge_history_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_weigh_in_checks values ('personal_challenge_history_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', withdrawn_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(test_challenge_id);
    insert into slimpossible_group_weigh_in_checks values ('withdrawn_member_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_weigh_in_checks values ('withdrawn_member_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(test_challenge_id);
    insert into slimpossible_group_weigh_in_checks values ('outsider_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_weigh_in_checks values ('outsider_denied', true);
  end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform * from public.get_group_weigh_in_history(other_challenge_id);
    insert into slimpossible_group_weigh_in_checks values ('cross_challenge_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_weigh_in_checks values ('cross_challenge_denied', true);
  end;

  execute 'reset role';
  update public.personal_weigh_ins
  set weight_kg = 99
  where user_id = member_id
    and recorded_date = current_date - 14;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select to_jsonb(history) into summary
  from public.get_group_weigh_in_history(test_challenge_id) as history
  order by history.recorded_date desc limit 1;
  if summary is null then
    raise exception 'Correction fixture returned no shared history row.';
  end if;
  insert into slimpossible_group_weigh_in_checks values
    ('correction_recalculates_shared_delta',
      summary -> 'change_since_previous_kg' = '-0.5'::jsonb);

  execute 'reset role';
  delete from public.personal_weigh_ins
  where user_id = member_id
    and recorded_date = current_date - 7;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into entry_count
  from public.get_group_weigh_in_history(test_challenge_id);
  insert into slimpossible_group_weigh_in_checks values
    ('deletion_removes_shared_entry', entry_count = 1);
end;
$$;

select check_name, passed
from slimpossible_group_weigh_in_checks
order by check_name;

do $$
begin
  if exists (
    select 1 from slimpossible_group_weigh_in_checks where not passed
  ) then
    raise exception 'One or more group weigh-in privacy checks failed.';
  end if;
end;
$$;

rollback;

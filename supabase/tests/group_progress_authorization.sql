-- Optional live authorization check for the privacy-safe group progress RPC.
-- Run in the approved non-production Supabase SQL Editor as postgres after migrations.
-- Requires exactly three disposable auth users ordered: owner, member, unrelated user.
-- All inserted fixture data is rolled back; output contains check names only.

begin;

drop table if exists pg_temp.slimpossible_group_progress_checks;
create temp table slimpossible_group_progress_checks (
  check_name text primary key,
  passed boolean not null
);
grant all on table slimpossible_group_progress_checks to authenticated;

do $$
declare
  test_user_count integer;
  owner_id uuid;
  member_id uuid;
  unrelated_id uuid;
  challenge_id uuid := gen_random_uuid();
  owner_only_challenge_id uuid := gen_random_uuid();
  owner_participant_id uuid := gen_random_uuid();
  member_participant_id uuid := gen_random_uuid();
  summary jsonb;
begin
  select count(*)::integer into test_user_count from auth.users;
  if test_user_count <> 3 then
    raise exception 'Expected exactly three disposable test users; found %.', test_user_count;
  end if;

  select
    (max(id::text) filter (where user_order = 1))::uuid,
    (max(id::text) filter (where user_order = 2))::uuid,
    (max(id::text) filter (where user_order = 3))::uuid
    into owner_id, member_id, unrelated_id
  from (
    select id, row_number() over (order by created_at) as user_order
    from auth.users
  ) as ordered_users;

  insert into public.profiles (id, display_name)
  values
    (owner_id, 'Group test owner'),
    (member_id, 'Group test member'),
    (unrelated_id, 'Group test unrelated')
  on conflict (id) do nothing;

  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status
  ) values
    (challenge_id, owner_id, owner_id, 'Group progress test', '2026-09-01', '2026-12-01', 'active'),
    (owner_only_challenge_id, owner_id, owner_id, 'Owner-only test', '2026-09-01', '2026-12-01', 'active');

  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values
    (owner_participant_id, challenge_id, owner_id, 'Owner', 'active', 80, 75, now()),
    (member_participant_id, challenge_id, member_id, 'Member', 'active', 100, 90, now());

  insert into public.weigh_ins (participant_id, recorded_date, weight_kg, note)
  values
    (owner_participant_id, '2026-09-13', 80, 'private owner note'),
    (member_participant_id, '2026-09-13', 100, 'private member note'),
    (member_participant_id, '2026-09-20', 98, 'correctable private note');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select to_jsonb(result) into summary
  from public.get_group_progress_summary(challenge_id, '2026-09-20') as result;
  insert into slimpossible_group_progress_checks
  values ('active_member_receives_safe_partial_summary',
    summary ->> 'active_participant_count' = '2'
    and summary ->> 'eligible_participant_count' = '1'
    and summary -> 'weekly_winner_names' = '["Member"]'::jsonb
    and not (summary ? 'note')
    and not (summary ? 'private_note')
    and not (summary ? 'raw_weigh_ins')
    and not (summary ? 'user_id')
    and not (summary ? 'weight_kg')
    and not (summary ? 'participant_id'));

  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  if auth.uid() is distinct from unrelated_id then
    raise exception 'Unrelated-user denial check has the wrong JWT subject.';
  end if;
  begin
    perform * from public.get_group_progress_summary(challenge_id, '2026-09-20');
    insert into slimpossible_group_progress_checks values
      ('unrelated_user_is_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_progress_checks values
      ('unrelated_user_is_denied', true);
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  begin
    perform * from public.get_group_progress_summary(owner_only_challenge_id, '2026-09-20');
    insert into slimpossible_group_progress_checks values
      ('owner_without_membership_is_denied', false);
  exception when insufficient_privilege then
    insert into slimpossible_group_progress_checks values
      ('owner_without_membership_is_denied', true);
  end;

  execute 'reset role';
  insert into public.weigh_ins (participant_id, recorded_date, weight_kg, note)
  values (owner_participant_id, '2026-09-20', 80, 'late private owner note');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select to_jsonb(result) into summary
  from public.get_group_progress_summary(challenge_id, '2026-09-20') as result;
  insert into slimpossible_group_progress_checks
  values ('late_sunday_entry_recomputes_shared_result',
    summary ->> 'eligible_participant_count' = '2'
    and summary -> 'weekly_winner_names' = '["Member"]'::jsonb);

  execute 'reset role';
  update public.weigh_ins
  set weight_kg = 101
  where participant_id = member_participant_id
    and recorded_date = '2026-09-20';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select to_jsonb(result) into summary
  from public.get_group_progress_summary(challenge_id, '2026-09-20') as result;
  insert into slimpossible_group_progress_checks
  values ('corrected_sunday_entry_recomputes_winner',
    summary -> 'weekly_winner_names' = '["Owner"]'::jsonb);
end;
$$;

select check_name, passed
from slimpossible_group_progress_checks
order by check_name;

rollback;

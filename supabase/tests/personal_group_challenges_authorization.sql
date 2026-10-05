-- Personal/group challenge boundary checks for an approved non-production
-- Supabase project. Run as postgres after the checked-in migrations. The
-- owner must explicitly identify three existing disposable Auth UUIDs below.
-- Never infer identities from creation order. Run the WHOLE script in one batch;
-- results are returned before ROLLBACK removes every fixture and profile change.

begin;

select set_config('slimpossible.test_owner_id', 'REPLACE_OWNER_UUID', true);
select set_config('slimpossible.test_member_id', 'REPLACE_MEMBER_UUID', true);
select set_config('slimpossible.test_outsider_id', 'REPLACE_OUTSIDER_UUID', true);

drop table if exists pg_temp.slimpossible_personal_group_results;

create temp table slimpossible_personal_group_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
);

grant all on table slimpossible_personal_group_results to authenticated, anon;

do $$
declare
  user_count integer;
  owner_id uuid;
  member_id uuid;
  unrelated_id uuid;
  personal_challenge_id uuid := gen_random_uuid();
  group_challenge_id uuid := gen_random_uuid();
  legacy_challenge_id uuid := gen_random_uuid();
  personal_participant_id uuid := gen_random_uuid();
  unexpected_member_participant_id uuid := gen_random_uuid();
  visible_count integer;
  affected integer;
  group_invite_id uuid;
  group_invite_token text;
begin
  -- Invalid/unfilled UUIDs fail here, before any persistent-table DML.
  owner_id := current_setting('slimpossible.test_owner_id')::uuid;
  member_id := current_setting('slimpossible.test_member_id')::uuid;
  unrelated_id := current_setting('slimpossible.test_outsider_id')::uuid;
  if owner_id = member_id or owner_id = unrelated_id or member_id = unrelated_id then
    raise exception 'Owner, member and outsider must be distinct approved disposable users.';
  end if;
  select count(*)::integer into user_count from auth.users
  where id in (owner_id, member_id, unrelated_id);
  if user_count <> 3 then
    raise exception 'All three explicitly approved disposable test users must exist; found %.', user_count;
  end if;

  insert into public.profiles (id, display_name)
  values
    (owner_id, 'Personal/group test owner'),
    (member_id, 'Personal/group test member'),
    (unrelated_id, 'Personal/group test outsider')
  on conflict (id) do nothing;

  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
  ) values (
    personal_challenge_id, owner_id, owner_id, '[16.1 disposable] Private personal test',
    current_date, current_date + 30, 'active', 'personal'
  ), (
    group_challenge_id, owner_id, owner_id, '[16.1 disposable] Group test',
    current_date, current_date + 30, 'active', 'group'
  );

  -- A pre-feature row is left NULL; the application maps it to a legacy group.
  insert into public.challenges (
    id, owner_id, created_by, name, start_date, end_date, status
  ) values (
    legacy_challenge_id, owner_id, owner_id, '[16.1 disposable] Legacy group test',
    current_date, current_date + 30, 'active'
  );

  insert into public.participants (
    challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values (
    group_challenge_id, member_id, 'Group test member', 'active', 90, 80, now()
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  select count(*)::integer into visible_count
  from public.challenges
  where id = personal_challenge_id;
  insert into slimpossible_personal_group_results
  values ('owner_can_read_personal_challenge', visible_count = 1, 'owner row visible');

  select count(*)::integer into visible_count
  from public.participants
  where challenge_id = personal_challenge_id;
  insert into slimpossible_personal_group_results
  values ('owner_creation_did_not_enroll_owner', visible_count = 0, 'no implicit membership');

  begin
    insert into public.participants (
      id, challenge_id, user_id, display_name, status,
      starting_weight_kg, target_weight_kg, joined_at
    ) values (
      personal_participant_id, personal_challenge_id, owner_id,
      'Personal owner', 'active', 90, 80, now()
    );
    get diagnostics affected = row_count;
    insert into slimpossible_personal_group_results
    values ('owner_can_explicitly_enroll_in_personal', affected = 1, 'explicit enrollment allowed');
  exception when others then
    insert into slimpossible_personal_group_results
    values ('owner_can_explicitly_enroll_in_personal', false, 'explicit enrollment rejected');
  end;

  begin
    insert into public.participants (
      challenge_id, user_id, display_name, status,
      starting_weight_kg, target_weight_kg, joined_at
    ) values (
      personal_challenge_id, member_id, 'Other person', 'active', 90, 80, now()
    );
    insert into slimpossible_personal_group_results
    values ('owner_cannot_add_another_person_to_personal', false, 'insert unexpectedly allowed');
  exception when others then
    insert into slimpossible_personal_group_results
    values ('owner_cannot_add_another_person_to_personal', true, 'insert denied');
  end;

  begin
    select invite_id, token into group_invite_id, group_invite_token
    from public.create_challenge_invite(personal_challenge_id, now() + interval '7 days');
    insert into slimpossible_personal_group_results
    values ('personal_challenge_cannot_issue_invite', false, 'invite unexpectedly allowed');
  exception when others then
    insert into slimpossible_personal_group_results
    values ('personal_challenge_cannot_issue_invite', true, 'invite denied');
  end;

  begin
    update public.challenges
    set challenge_kind = 'group'
    where id = personal_challenge_id;
    get diagnostics affected = row_count;
    insert into slimpossible_personal_group_results
    values ('challenge_kind_cannot_be_reclassified', affected = 0, 'kind remains immutable');
  exception when others then
    insert into slimpossible_personal_group_results
    values ('challenge_kind_cannot_be_reclassified', true, 'kind change denied');
  end;

  -- Simulate an unexpected privileged/imported participant row to verify the
  -- read policies still hide personal membership and metadata from that user.
  execute 'reset role';
  insert into public.participants (
    id, challenge_id, user_id, display_name, status,
    starting_weight_kg, target_weight_kg, joined_at
  ) values (
    unexpected_member_participant_id, personal_challenge_id, member_id,
    'Unexpected personal member', 'active', 90, 80, now()
  );
  execute 'set local role authenticated';

  select invite_id, token into group_invite_id, group_invite_token
  from public.create_challenge_invite(group_challenge_id, now() + interval '7 days');
  insert into slimpossible_personal_group_results
  values ('group_challenge_can_still_issue_invite', group_invite_id is not null, 'group invite allowed');

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into visible_count
  from public.challenges where id = personal_challenge_id;
  insert into slimpossible_personal_group_results
  values ('member_cannot_read_personal_challenge', visible_count = 0, 'personal row hidden');

  select count(*)::integer into visible_count
  from public.participants where challenge_id = personal_challenge_id;
  insert into slimpossible_personal_group_results
  values ('member_cannot_read_personal_participants', visible_count = 0, 'personal membership hidden');

  select count(*)::integer into visible_count
  from public.challenges where id = group_challenge_id;
  insert into slimpossible_personal_group_results
  values ('member_can_read_group_challenge', visible_count = 1, 'group row visible');

  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  select count(*)::integer into visible_count
  from public.challenges where id in (personal_challenge_id, group_challenge_id);
  insert into slimpossible_personal_group_results
  values ('outsider_cannot_read_either_context', visible_count = 0, 'rows hidden');

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select check_name, passed, detail
from slimpossible_personal_group_results
order by check_name;

rollback;

-- Slimpossible live RLS authorization checks.
--
-- Run this file in the approved non-production Supabase SQL Editor as the
-- postgres role, after the checked-in migrations. The test project must
-- contain exactly three disposable auth users in creation order:
-- owner, member, unrelated-user. The script returns only check names and
-- pass/fail details; it never selects emails, user IDs, or private rows.

drop table if exists pg_temp.slimpossible_rls_results;

create temp table slimpossible_rls_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
);

grant all on table slimpossible_rls_results to authenticated, anon;

do $$
declare
  user_count integer;
  owner_id uuid;
  member_id uuid;
  unrelated_id uuid;
  challenge_id uuid := gen_random_uuid();
  owner_write_challenge_id uuid := gen_random_uuid();
  v_participant_id uuid := gen_random_uuid();
  row_count integer;
  affected integer;
  owner_profile_existed boolean;
  member_profile_existed boolean;
  unrelated_profile_existed boolean;
begin
  select count(*)::integer
    into user_count
  from auth.users;

  if user_count <> 3 then
    raise exception
      'Expected exactly three disposable test users; found %.', user_count;
  end if;

  select
    (max(id::text) filter (where creation_order = 1))::uuid,
    (max(id::text) filter (where creation_order = 2))::uuid,
    (max(id::text) filter (where creation_order = 3))::uuid
    into owner_id, member_id, unrelated_id
  from (
    select
      id,
      row_number() over (order by created_at asc) as creation_order
    from auth.users
  ) as ordered_users;

  select exists (
    select 1 from public.profiles as p where p.id = owner_id
  ) into owner_profile_existed;
  select exists (
    select 1 from public.profiles as p where p.id = member_id
  ) into member_profile_existed;
  select exists (
    select 1 from public.profiles as p where p.id = unrelated_id
  ) into unrelated_profile_existed;

  insert into public.profiles (id, display_name)
  values
    (owner_id, 'RLS test owner'),
    (member_id, 'RLS test member'),
    (unrelated_id, 'RLS test unrelated')
  on conflict (id) do nothing;

  insert into public.challenges (
    id,
    owner_id,
    created_by,
    name,
    description,
    start_date,
    end_date,
    target_weight_kg,
    status
  ) values (
    challenge_id,
    owner_id,
    owner_id,
    'RLS authorization test challenge',
    'Rolled back test fixture',
    current_date,
    current_date + 30,
    80,
    'active'
  );

  insert into public.participants (
    id,
    challenge_id,
    user_id,
    display_name,
    status,
    starting_weight_kg,
    target_weight_kg,
    joined_at
  ) values (
    v_participant_id,
    challenge_id,
    member_id,
    'RLS test member',
    'active',
    90,
    80,
    now()
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  select count(*)::integer
    into row_count
  from public.challenges as c
  where c.id = challenge_id;
  insert into slimpossible_rls_results
  values ('owner_can_read_owned_challenge', row_count = 1, 'row visible');

  begin
    insert into public.challenges (
      id,
      owner_id,
      created_by,
      name,
      start_date,
      end_date,
      status
    ) values (
      owner_write_challenge_id,
      owner_id,
      owner_id,
      'RLS owner write test',
      current_date,
      current_date + 1,
      'draft'
    );
    get diagnostics affected = row_count;
    insert into slimpossible_rls_results
    values ('owner_can_insert_owned_challenge', affected = 1, 'insert allowed');
  exception when others then
    insert into slimpossible_rls_results
    values ('owner_can_insert_owned_challenge', false, 'insert rejected');
  end;

  update public.challenges as c
  set name = 'RLS owner write test updated'
  where c.id = owner_write_challenge_id;
  get diagnostics affected = row_count;
  insert into slimpossible_rls_results
  values ('owner_can_update_owned_challenge', affected = 1, 'update allowed');

  select count(*)::integer
    into row_count
  from public.participants as p
  where p.id = v_participant_id;
  insert into slimpossible_rls_results
  values ('owner_can_read_member_participant', row_count = 1, 'row visible');

  select count(*)::integer
    into row_count
  from public.weigh_ins as wi
  where wi.participant_id = v_participant_id;
  insert into slimpossible_rls_results
  values ('owner_cannot_read_private_weigh_ins', row_count = 0, 'raw rows hidden');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);

  select count(*)::integer
    into row_count
  from public.challenges as c
  where c.id = challenge_id;
  insert into slimpossible_rls_results
  values ('member_can_read_required_challenge_metadata', row_count = 1, 'row visible');

  select count(*)::integer
    into row_count
  from public.challenges as c
  where c.owner_id = member_id;
  insert into slimpossible_rls_results
  values ('member_test_user_owns_no_challenges', row_count = 0, 'ownerless fixture account');

  select count(*)::integer
    into row_count
  from public.challenges as c
  where c.id = challenge_id and c.owner_id <> member_id;
  insert into slimpossible_rls_results
  values ('member_can_list_joined_challenge_without_owned_challenges', row_count = 1, 'joined challenge visible');

  select count(*)::integer
    into row_count
  from public.participants as p
  where p.id = v_participant_id;
  insert into slimpossible_rls_results
  values ('member_can_read_own_participant', row_count = 1, 'row visible');

  begin
    insert into public.weigh_ins (
      participant_id,
      recorded_date,
      weight_kg,
      note
    ) values (
      v_participant_id,
      current_date,
      89.5,
      'RLS test private note'
    );
    get diagnostics affected = row_count;
    insert into slimpossible_rls_results
    values ('member_can_insert_own_weigh_in', affected = 1, 'insert allowed');
  exception when others then
    insert into slimpossible_rls_results
    values ('member_can_insert_own_weigh_in', false, 'insert rejected');
  end;

  select count(*)::integer
    into row_count
  from public.weigh_ins as wi
  where wi.participant_id = v_participant_id;
  insert into slimpossible_rls_results
  values ('member_can_read_own_weigh_in', row_count = 1, 'row visible');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);

  select count(*)::integer
    into row_count
  from public.challenges as c
  where c.id = challenge_id;
  insert into slimpossible_rls_results
  values ('unrelated_cannot_read_challenge', row_count = 0, 'row hidden');

  select count(*)::integer
    into row_count
  from public.participants as p
  where p.id = v_participant_id;
  insert into slimpossible_rls_results
  values ('unrelated_cannot_read_participant', row_count = 0, 'row hidden');

  select count(*)::integer
    into row_count
  from public.weigh_ins as wi
  where wi.participant_id = v_participant_id;
  insert into slimpossible_rls_results
  values ('unrelated_cannot_read_weigh_in', row_count = 0, 'row hidden');

  begin
    insert into public.weigh_ins (
      participant_id,
      recorded_date,
      weight_kg,
      note
    ) values (
      v_participant_id,
      current_date + 1,
      89,
      'RLS unrelated write attempt'
    );
    insert into slimpossible_rls_results
    values ('unrelated_cannot_insert_weigh_in', false, 'insert unexpectedly allowed');
  exception when others then
    insert into slimpossible_rls_results
    values ('unrelated_cannot_insert_weigh_in', true, 'insert denied');
  end;

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);

  select count(*)::integer
    into row_count
  from public.challenges;
  insert into slimpossible_rls_results
  values ('anonymous_cannot_read_challenges', row_count = 0, 'rows hidden');

  select count(*)::integer
    into row_count
  from public.participants;
  insert into slimpossible_rls_results
  values ('anonymous_cannot_read_participants', row_count = 0, 'rows hidden');

  select count(*)::integer
    into row_count
  from public.weigh_ins;
  insert into slimpossible_rls_results
  values ('anonymous_cannot_read_weigh_ins', row_count = 0, 'rows hidden');

  begin
    insert into public.challenges (
      owner_id,
      created_by,
      name,
      start_date,
      end_date
    ) values (
      owner_id,
      owner_id,
      'RLS anonymous write attempt',
      current_date,
      current_date + 1
    );
    insert into slimpossible_rls_results
    values ('anonymous_cannot_insert_challenge', false, 'insert unexpectedly allowed');
  exception when others then
    insert into slimpossible_rls_results
    values ('anonymous_cannot_insert_challenge', true, 'insert denied');
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    update public.participants as p
    set user_id = unrelated_id
    where p.id = v_participant_id;
    get diagnostics affected = row_count;
    insert into slimpossible_rls_results
    values (
      'owner_cannot_reassign_member_with_weigh_ins',
      affected = 0,
      'reassignment blocked'
    );
  exception when others then
    insert into slimpossible_rls_results
    values (
      'owner_cannot_reassign_member_with_weigh_ins',
      true,
      'reassignment blocked'
    );
  end;

  update public.participants as p
  set display_name = 'RLS test member updated'
  where p.id = v_participant_id;
  get diagnostics affected = row_count;
  insert into slimpossible_rls_results
  values ('owner_can_update_safe_membership_fields', affected = 1, 'update allowed');

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);

  delete from public.challenges as c
  where c.id in (challenge_id, owner_write_challenge_id);

  if not owner_profile_existed then
    delete from public.profiles as p where p.id = owner_id;
  end if;
  if not member_profile_existed then
    delete from public.profiles as p where p.id = member_id;
  end if;
  if not unrelated_profile_existed then
    delete from public.profiles as p where p.id = unrelated_id;
  end if;
end;
$$;

select check_name, passed, detail
from slimpossible_rls_results
order by check_name;

drop table slimpossible_rls_results;

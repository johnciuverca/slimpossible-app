-- Slimpossible live invitation authorization checks.
--
-- Run after the checked-in migrations in the approved non-production
-- Supabase SQL Editor as postgres. The project must contain exactly three
-- disposable Auth users in creation order: owner, member, unrelated-user.
-- The result contains check names only; it never returns tokens or IDs.

drop table if exists pg_temp.slimpossible_invite_results;

create temp table slimpossible_invite_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
);

do $$
declare
  user_count integer;
  owner_id uuid;
  member_id uuid;
  unrelated_id uuid;
  v_challenge_id uuid := gen_random_uuid();
  v_invite_id uuid;
  invite_token text;
  expired_token text;
  v_participant_id uuid;
  participant_count integer;
  invite_status text;
  profile_exists boolean;
begin
  select count(*)::integer into user_count from auth.users;
  if user_count <> 3 then
    raise exception 'Expected exactly three disposable test users; found %.', user_count;
  end if;

  select
    (max(id::text) filter (where creation_order = 1))::uuid,
    (max(id::text) filter (where creation_order = 2))::uuid,
    (max(id::text) filter (where creation_order = 3))::uuid
  into owner_id, member_id, unrelated_id
  from (
    select id, row_number() over (order by created_at asc) as creation_order
    from auth.users
  ) as ordered_users;

  insert into public.profiles (id, display_name)
  values
    (owner_id, 'Invite test owner'),
    (unrelated_id, 'Invite test unrelated')
  on conflict (id) do nothing;

  insert into public.challenges (
    id,
    owner_id,
    created_by,
    name,
    start_date,
    end_date,
    status
  ) values (
    v_challenge_id,
    owner_id,
    owner_id,
    'Invitation authorization test',
    current_date,
    current_date + 30,
    'active'
  );

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  select invite_id, token into v_invite_id, invite_token
  from public.create_challenge_invite(
    v_challenge_id,
    now() + interval '7 days'
  );
  insert into slimpossible_invite_results
  values ('owner_can_create_invite', v_invite_id is not null and invite_token is not null, 'created');

  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  begin
    perform public.revoke_challenge_invite(v_invite_id);
    insert into slimpossible_invite_results
    values ('unrelated_cannot_revoke_invite', false, 'revoke unexpectedly allowed');
  exception when others then
    insert into slimpossible_invite_results
    values ('unrelated_cannot_revoke_invite', true, 'revoke denied');
  end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*)::integer into participant_count
  from public.accept_challenge_invite(
    invite_token,
    'Accepted member',
    92.5,
    80
  );
  select p.id into v_participant_id
  from public.participants as p
  where p.challenge_id = v_challenge_id and p.user_id = member_id;
  select exists (
    select 1 from public.profiles as p where p.id = member_id
  ) into profile_exists;
  insert into slimpossible_invite_results
  values (
    'acceptance_binds_to_auth_profile',
    v_participant_id is not null and profile_exists,
    'new profile and membership bound'
  );

  perform public.accept_challenge_invite(invite_token, 'Changed name', 90, 78);
  select count(*)::integer into participant_count
  from public.participants
  where participants.challenge_id = v_challenge_id
    and participants.user_id = member_id;
  insert into slimpossible_invite_results
  values ('repeated_acceptance_does_not_duplicate', participant_count = 1, 'one membership');

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.revoke_challenge_invite(v_invite_id);
  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  select status into invite_status
  from public.preview_challenge_invite(invite_token);
  insert into slimpossible_invite_results
  values ('revoked_invite_is_reported', invite_status = 'revoked', 'revoked');

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select token into expired_token
  from public.create_challenge_invite(v_challenge_id, now() + interval '7 days');
  update public.challenge_invites
  set expires_at = now() - interval '1 minute'
  where token_hash = encode(digest(expired_token, 'sha256'), 'hex');
  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  select status into invite_status
  from public.preview_challenge_invite(expired_token);
  insert into slimpossible_invite_results
  values ('expired_invite_is_reported', invite_status = 'expired', 'expired');

  begin
    update public.participants
    set user_id = unrelated_id
    where id = v_participant_id;
    insert into slimpossible_invite_results
    values ('unrelated_cannot_impersonate_member', false, 'update unexpectedly allowed');
  exception when others then
    insert into slimpossible_invite_results
    values ('unrelated_cannot_impersonate_member', true, 'identity update denied');
  end;

  perform set_config('request.jwt.claim.sub', unrelated_id::text, true);
  begin
    update public.challenges
    set owner_id = unrelated_id
    where id = v_challenge_id;
    insert into slimpossible_invite_results
    values ('unrelated_cannot_change_ownership', false, 'update unexpectedly allowed');
  exception when others then
    insert into slimpossible_invite_results
    values ('unrelated_cannot_change_ownership', true, 'ownership update denied');
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.challenges where id = v_challenge_id;
end;
$$;

select check_name, passed, detail
from slimpossible_invite_results
order by check_name;

drop table slimpossible_invite_results;

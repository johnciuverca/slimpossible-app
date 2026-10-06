-- LOCAL ONLY. psql -v phase=before|forward|recovery
select set_config('slimpossible.local_acl_phase', :'phase', false);
do $$
declare
  phase text := current_setting('slimpossible.local_acl_phase');
  target text;
  expected_anon boolean;
  expected_auth boolean;
  actual_grants jsonb;
  before_grants jsonb;
begin
  foreach target in array array[
    'accept_challenge_invite(text,text,numeric,numeric)',
    'create_challenge_invite(uuid,timestamp with time zone)',
    'get_challenge_progress_summary(uuid)', 'is_challenge_member(uuid)',
    'list_challenge_invites(uuid)', 'revoke_challenge_invite(uuid)',
    'prevent_challenge_ownership_change()', 'prevent_participant_user_reassignment()',
    'prevent_challenge_kind_change()', 'prevent_personal_challenge_invites()',
    'preview_challenge_invite(text)', 'get_group_progress_summary(uuid,date)',
    'get_provisional_group_leader_summary(uuid,date)'
  ] loop
    expected_anon := target = 'preview_challenge_invite(text)'
      or (phase <> 'forward' and target not in (
        'get_group_progress_summary(uuid,date)', 'get_provisional_group_leader_summary(uuid,date)'));
    expected_auth := not (phase = 'forward' and target in (
      'prevent_challenge_kind_change()', 'prevent_personal_challenge_invites()'));
    if has_function_privilege('anon', ('public.' || target)::regprocedure, 'EXECUTE') <> expected_anon
       or has_function_privilege('authenticated', ('public.' || target)::regprocedure, 'EXECUTE') <> expected_auth
       or not has_function_privilege('service_role', ('public.' || target)::regprocedure, 'EXECUTE') then
      raise exception 'Unexpected effective ACL for % at %.', target, phase;
    end if;
    if phase = 'recovery' or target in (
      'preview_challenge_invite(text)', 'get_group_progress_summary(uuid,date)',
      'get_provisional_group_leader_summary(uuid,date)'
    ) then
      select grants into before_grants from local_test.acl_before where identity = target;
      select jsonb_agg(jsonb_build_array(a.grantor, a.grantee, a.privilege_type, a.is_grantable)
        order by a.grantor, a.grantee, a.privilege_type) into actual_grants
      from pg_proc p cross join lateral aclexplode(p.proacl) a
      where p.oid = ('public.' || target)::regprocedure;
      if actual_grants is distinct from before_grants then
        raise exception 'Recovery did not exactly restore grants/grantors/options for %.', target;
      end if;
    end if;
  end loop;
  if exists (
    (select * from pg_default_acl except select * from local_test.defaults_before)
    union all (select * from local_test.defaults_before except select * from pg_default_acl)
  ) then raise exception 'Global/schema default grants changed.'; end if;
  raise notice '13 effective ACL checks passed for phase %; defaults unchanged.', phase;
end;
$$;

do $$
begin
  if exists (
    with actual as (
      select 'profiles' as name, to_jsonb(p) as row from public.profiles p
      union all select 'challenges', to_jsonb(c) from public.challenges c
      union all select 'participants', to_jsonb(p) from public.participants p
      union all select 'weigh_ins', to_jsonb(w) from public.weigh_ins w
      union all select 'challenge_invites', to_jsonb(i) from public.challenge_invites i
    )
    (select * from actual except select * from local_test.data_before)
    union all (select * from local_test.data_before except select * from actual)
  ) then raise exception 'Harness/grant operation changed existing records or left fixtures.'; end if;
  raise notice 'Exact sentinel records preserved; no test fixtures/profiles remain.';
end;
$$;

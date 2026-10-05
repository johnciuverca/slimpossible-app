-- Read-only before/after evidence: direct grants (grantor/grant option included)
-- and effective client privileges. Never invokes the inspected functions.
begin transaction read only;
select p.oid::regprocedure::text as function_identity,
  pg_get_userbyid(p.proowner) as owner,
  a.grantor::regrole::text as grantor,
  case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
  a.privilege_type, a.is_grantable,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public' and p.proname in (
  'accept_challenge_invite', 'create_challenge_invite', 'get_challenge_progress_summary',
  'is_challenge_member', 'list_challenge_invites', 'revoke_challenge_invite',
  'prevent_challenge_ownership_change', 'prevent_participant_user_reassignment',
  'prevent_challenge_kind_change', 'prevent_personal_challenge_invites',
  'preview_challenge_invite', 'get_group_progress_summary', 'get_provisional_group_leader_summary'
)
order by function_identity, grantee;
select pg_get_userbyid(d.defaclrole) as owner, n.nspname as schema,
  d.defaclobjtype, d.defaclacl::text as default_acl
from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
where d.defaclobjtype = 'f' and d.defaclrole = 'postgres'::regrole;
rollback;

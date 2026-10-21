-- Reviewed ACL convergence candidate for the staging snapshot of 2026-10-05.
-- NO remote application is implied. Apply only after owner recovery approval.
-- Direct Supabase default grants survive REVOKE FROM PUBLIC; remove only the
-- inspected client-role discrepancy, without changing global default grants.
-- The matching rollback restores exactly the inspected pre-change ACLs.
begin;

do $$
declare
  target text;
  client_roles text[];
  invalid_grant boolean;
begin
  if current_user <> 'postgres' then
    raise exception 'ACL convergence requires the reviewed postgres owner role.';
  end if;
  foreach target in array array[
    'public.accept_challenge_invite(text,text,numeric,numeric)',
    'public.create_challenge_invite(uuid,timestamptz)',
    'public.get_challenge_progress_summary(uuid)',
    'public.is_challenge_member(uuid)',
    'public.list_challenge_invites(uuid)',
    'public.revoke_challenge_invite(uuid)',
    'public.prevent_challenge_ownership_change()',
    'public.prevent_participant_user_reassignment()',
    'public.prevent_challenge_kind_change()',
    'public.prevent_personal_challenge_invites()'
  ] loop
    select array_agg(r.rolname::text order by r.rolname::text),
      bool_or(a.is_grantable or a.grantor <> 'postgres'::regrole::oid)
    into client_roles, invalid_grant
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
    where p.oid = target::regprocedure;
    if client_roles is distinct from array['anon', 'authenticated', 'postgres', 'service_role']::text[]
       or invalid_grant or (select proowner from pg_proc where oid = target::regprocedure) <> 'postgres'::regrole::oid then
      raise exception 'ACL drift for %: export/review actual ACLs before convergence.', target;
    end if;
  end loop;
end;
$$;

revoke execute on function
  public.accept_challenge_invite(text,text,numeric,numeric),
  public.create_challenge_invite(uuid,timestamptz),
  public.get_challenge_progress_summary(uuid),
  public.is_challenge_member(uuid),
  public.list_challenge_invites(uuid),
  public.revoke_challenge_invite(uuid),
  public.prevent_challenge_ownership_change(),
  public.prevent_participant_user_reassignment(),
  public.prevent_challenge_kind_change(),
  public.prevent_personal_challenge_invites()
from anon;

revoke execute on function public.prevent_challenge_kind_change(),
  public.prevent_personal_challenge_invites() from authenticated;

-- Authenticated membership helpers remain executable for RLS evaluation.
-- preview_challenge_invite's anon grant and all service_role grants are untouched.
commit;

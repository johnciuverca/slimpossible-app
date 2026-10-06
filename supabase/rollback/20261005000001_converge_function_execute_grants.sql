-- Exact inverse for the inspected staging ACL snapshot, not a generic rollback.
-- Restores the previous exposure, so use only with explicit recovery approval.
-- Stop on intervening ACL drift; do not overwrite unrelated permission changes.
begin;

do $$
declare
  target text;
  actual_roles text[];
  expected_roles text[];
  invalid_grant boolean;
begin
  if current_user <> 'postgres' then
    raise exception 'ACL recovery requires the reviewed postgres owner role.';
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
    expected_roles := case when target in (
      'public.prevent_challenge_kind_change()', 'public.prevent_personal_challenge_invites()'
    ) then array['postgres', 'service_role']::text[]
      else array['authenticated', 'postgres', 'service_role']::text[] end;
    select array_agg(r.rolname::text order by r.rolname::text),
      bool_or(a.is_grantable or a.grantor <> 'postgres'::regrole::oid)
    into actual_roles, invalid_grant
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
    where p.oid = target::regprocedure;
    if actual_roles is distinct from expected_roles or invalid_grant
       or (select proowner from pg_proc where oid = target::regprocedure) <> 'postgres'::regrole::oid then
      raise exception 'ACL drift for %: export/review actual ACLs before recovery.', target;
    end if;
  end loop;
end;
$$;

grant execute on function
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
to anon;

grant execute on function public.prevent_challenge_kind_change(),
  public.prevent_personal_challenge_invites() to authenticated;
commit;

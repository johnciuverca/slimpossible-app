-- LOCAL DISPOSABLE DATABASE ONLY. Run after the five baseline migrations,
-- disabling table/sequence defaults, then the exact 12-file #247 pending set.
\set ON_ERROR_STOP on

do $$
declare
  api_table text;
  role_name text;
  privilege_name text;
  old_table record;
begin
  for api_table in
    select unnest(array[
      'personal_weigh_ins',
      'personal_weigh_in_group_shares',
      'personal_weigh_in_legacy_map',
      'participant_target_milestones'
    ])
  loop
    if not coalesce((
      select relation.relrowsecurity
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = api_table
    ), false) then
      raise exception 'RLS is not enabled on public.%', api_table;
    end if;
  end loop;

  for role_name in select unnest(array['anon', 'authenticated', 'service_role'])
  loop
    for privilege_name in select unnest(array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ])
    loop
      for api_table in select unnest(array[
        'personal_weigh_ins',
        'personal_weigh_in_group_shares',
        'personal_weigh_in_legacy_map',
        'participant_target_milestones'
      ])
      loop
        if api_table = 'personal_weigh_ins'
           and role_name = 'authenticated'
           and privilege_name = 'SELECT' then
          if not has_table_privilege(role_name, 'public.' || api_table, privilege_name) then
            raise exception 'Expected explicit authenticated SELECT on public.%', api_table;
          end if;
        elsif has_table_privilege(role_name, 'public.' || api_table, privilege_name) then
          raise exception 'Unexpected % privilege for % on public.%',
            privilege_name, role_name, api_table;
        end if;
      end loop;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral aclexplode(relation.relacl) as privilege
    where namespace.nspname = 'public'
      and relation.relname in (
        'personal_weigh_ins', 'personal_weigh_in_group_shares',
        'personal_weigh_in_legacy_map', 'participant_target_milestones'
      )
      and privilege.grantee = 0
  ) then
    raise exception 'A new RPC/private table has a PUBLIC grant';
  end if;

  if exists (
    select 1
    from pg_class as sequence
    join pg_depend as dependency on dependency.objid = sequence.oid
    where sequence.relkind = 'S'
      and dependency.refobjid in (
        'public.personal_weigh_ins'::regclass,
        'public.personal_weigh_in_group_shares'::regclass,
        'public.personal_weigh_in_legacy_map'::regclass,
        'public.participant_target_milestones'::regclass
      )
  ) then
    raise exception 'UUID-keyed tables unexpectedly created owned sequences';
  end if;

  for old_table in
    select relname, relacl, relrowsecurity, relforcerowsecurity
    from local_test.existing_public_table_access_before
  loop
    if not exists (
      select 1 from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = old_table.relname
        and relation.relacl is not distinct from old_table.relacl
        and relation.relrowsecurity = old_table.relrowsecurity
        and relation.relforcerowsecurity = old_table.relforcerowsecurity
    ) then
      raise exception 'Existing public table access/RLS changed for %', old_table.relname;
    end if;
  end loop;
end;
$$;

select 'PASS: exact least-privilege table grants, RLS, UUID sequences, and existing-table ACLs verified under no-auto-grants defaults' as result;

-- #247 owner-run catalog preflight. Review the target project identity in the
-- SQL editor before running. This reports schema/catalog/ACL metadata only; it
-- never reads application rows, executes an RPC, or changes database objects.
-- The migration ledger is inspected through catalogs only, so an absent ledger
-- is reported safely. This does not reconcile migration history or authorize
-- hosted operations. ACL output is direct/default grants only: role-membership-
-- derived effective access is not assessed. Schema USAGE ACLs are included.
-- Keep detailed output private.

begin transaction read only;

select current_database() as database_name,
       current_user as session_role,
       current_setting('transaction_read_only') as transaction_read_only;

-- Schema ACL entries/defaults, including USAGE. Membership-derived access is
-- intentionally out of scope.
select n.nspname as schema_name,
       pg_catalog.pg_get_userbyid(n.nspowner) as owner,
       case when acl.grantee = 0 then 'PUBLIC'
            else grantee.rolname end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_catalog.pg_namespace n
cross join lateral pg_catalog.aclexplode(
  coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
) as acl
left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
where n.nspname in ('public', 'supabase_migrations')
order by n.nspname, grantee, acl.privilege_type;

-- Relations in public, including views and sequences; absence is represented
-- by an empty result rather than a missing-relation error.
select n.nspname as schema_name,
       c.relname as relation_name,
       c.relkind as relation_kind,
       pg_get_userbyid(c.relowner) as owner,
       c.relpersistence as persistence,
       c.relrowsecurity as row_level_security,
       c.relforcerowsecurity as force_row_level_security
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
order by c.relkind, c.relname;

-- Column definitions only; no table contents are selected.
select n.nspname as schema_name,
       c.relname as relation_name,
       a.attnum as ordinal_position,
       a.attname as column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null,
       pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_expression,
       a.attidentity as identity_kind,
       a.attgenerated as generated_kind
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d
  on d.adrelid = a.attrelid and d.adnum = a.attnum
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and a.attnum > 0
  and not a.attisdropped
order by c.relname, a.attnum;

-- Constraint and index definitions are schema metadata, not row data.
select n.nspname as schema_name,
       c.relname as relation_name,
       con.conname as object_name,
       con.contype as constraint_kind,
       con.convalidated as validated,
       pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, con.conname;

select schemaname as schema_name,
       tablename as relation_name,
       indexname as object_name,
       indexdef as definition
from pg_catalog.pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- Direct/default relation ACL entries, including built-in defaults when
-- relacl is NULL. Role-membership-derived effective access is not assessed.
select n.nspname as schema_name,
       c.relname as relation_name,
       case when acl.grantee = 0 then 'PUBLIC'
            else grantee.rolname end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(c.relacl, pg_catalog.acldefault(
    case when c.relkind = 'S' then 'S' else 'r' end, c.relowner
  ))
) as acl
left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
order by c.relname, grantee, acl.privilege_type;

select schemaname as schema_name,
       tablename as relation_name,
       policyname as policy_name,
       permissive,
       roles,
       cmd as command,
       qual as using_expression,
       with_check as check_expression
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;

select n.nspname as schema_name,
       c.relname as relation_name,
       t.tgname as trigger_name,
       t.tgenabled as enabled_state,
       pg_catalog.pg_get_triggerdef(t.oid, true) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;

-- Routine signatures, ownership, security mode, settings, and direct/default
-- ACL entries. Role-membership-derived access is not assessed.
-- Function bodies are intentionally omitted.
select n.nspname as schema_name,
       p.proname as routine_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prokind as routine_kind,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.proconfig as settings,
       case when acl.grantee = 0 then 'PUBLIC'
            else grantee.rolname end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
) as acl
left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
order by p.proname, identity_arguments, grantee, acl.privilege_type;

select e.extname as extension_name,
       e.extversion as extension_version,
       n.nspname as schema_name
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- Migration-ledger presence and structure only. This remains safe if either
-- the schema or table is absent; no ledger rows are read. If absent, history
-- must be reconciled through the separately approved supported workflow.
select exists (
         select 1
         from pg_catalog.pg_namespace n
         join pg_catalog.pg_class c on c.relnamespace = n.oid
         where n.nspname = 'supabase_migrations'
           and c.relname = 'schema_migrations'
           and c.relkind in ('r', 'p')
       ) as migration_ledger_present;

select a.attnum as ordinal_position,
       a.attname as column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'supabase_migrations'
  and c.relname = 'schema_migrations'
  and c.relkind in ('r', 'p')
  and a.attnum > 0
  and not a.attisdropped
order by a.attnum;

rollback;

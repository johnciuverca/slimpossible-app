-- LOCAL DISPOSABLE DATABASE ONLY. This fixture deliberately broadens the test
-- executor's defaults, never a source/hosted project's defaults. Restore a clean
-- pre-#210 database first; set slimpossible.disposable_acl_fixture=true explicitly.
-- Run with psql from this file's directory structure. Test DB is discarded/stopped.
\set ON_ERROR_STOP on
do $$ begin
  if current_setting('slimpossible.disposable_acl_fixture', true) is distinct from 'true' then
    raise exception 'Disposable local ACL fixture authorization required';
  end if;
  if to_regclass('public.personal_weigh_ins') is not null then
    raise exception 'Clean pre-210 fixture required';
  end if;
end $$;

alter default privileges in schema public grant all on tables to public, anon, authenticated;
alter default privileges in schema public grant all on sequences to public, anon, authenticated;
alter default privileges in schema public grant execute on functions to public, anon, authenticated;
create temp table fixture_defaults_before as select to_jsonb(d) as row_data from pg_default_acl d;
\ir ../migrations/20261007000000_personal_weigh_ins.sql
\ir ../migrations/20261008000000_allow_draft_group_weigh_in_sharing.sql

do $$ begin
  if exists(select row_data from fixture_defaults_before except select to_jsonb(d) from pg_default_acl d)
     or exists(select to_jsonb(d) from pg_default_acl d except select row_data from fixture_defaults_before) then
    raise exception 'Migration changed executor default ACLs';
  end if;
  if exists (
    select 1 from (values ('anon'), ('authenticated')) as client(role_name)
    cross join (values ('personal_weigh_ins'), ('personal_weigh_in_group_shares'),
      ('personal_weigh_in_legacy_map')) as relation(table_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as operation(privilege_name)
    where not (client.role_name = 'authenticated' and relation.table_name = 'personal_weigh_ins'
      and operation.privilege_name = 'SELECT')
      and has_table_privilege(client.role_name, 'public.' || relation.table_name, operation.privilege_name)
  ) or not has_table_privilege('authenticated', 'public.personal_weigh_ins', 'SELECT') then
    raise exception 'Permissive default grants survived canonical ACL reset';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(c.relacl) acl
    where n.nspname='public' and c.relname in
      ('personal_weigh_ins','personal_weigh_in_group_shares','personal_weigh_in_legacy_map')
      and acl.grantee=0
  ) then
    raise exception 'Canonical relation retains a PUBLIC grant';
  end if;
end $$;
select 'PASS permissive PUBLIC/anon/authenticated defaults are reset without changing default ACLs' as result;

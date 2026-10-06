-- Read-only catalog export. Execute only on the explicitly approved staging
-- project; contains no user records, credentials, DDL or DML. Compare definitions
-- with the final state of all seven timestamp-ordered migrations, not names alone.
begin transaction read only;

select jsonb_build_object(
  'columns', (select jsonb_agg(to_jsonb(c) order by c.table_name, c.ordinal_position)
    from (select table_name, ordinal_position, column_name, data_type,
      udt_name, is_nullable, column_default, numeric_precision, numeric_scale
      from information_schema.columns where table_schema = 'public'
      and table_name in ('profiles', 'challenges', 'participants', 'weigh_ins', 'challenge_invites')) c),
  'tables', (select jsonb_agg(jsonb_build_object('name', c.relname,
    'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'owner', pg_get_userbyid(c.relowner), 'acl', c.relacl::text) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('profiles', 'challenges', 'participants', 'weigh_ins', 'challenge_invites')),
  'constraints', (select jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text,
    'name', c.conname, 'validated', c.convalidated,
    'definition', pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text, c.conname)
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conrelid in (
      'public.profiles'::regclass, 'public.challenges'::regclass,
      'public.participants'::regclass, 'public.weigh_ins'::regclass,
      'public.challenge_invites'::regclass)),
  'indexes', (select jsonb_agg(to_jsonb(i) order by i.tablename, i.indexname)
    from pg_indexes i where i.schemaname = 'public'
    and i.tablename in ('profiles', 'challenges', 'participants', 'weigh_ins', 'challenge_invites')),
  'policies', (select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
    from pg_policies p where p.schemaname = 'public'
    and p.tablename in ('profiles', 'challenges', 'participants', 'weigh_ins', 'challenge_invites')),
  'triggers', (select jsonb_agg(jsonb_build_object('table', t.tgrelid::regclass::text,
    'name', t.tgname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)) order by t.tgname)
    from pg_trigger t where not t.tgisinternal and t.tgrelid in (
      'public.profiles'::regclass, 'public.challenges'::regclass,
      'public.participants'::regclass, 'public.weigh_ins'::regclass,
      'public.challenge_invites'::regclass)),
  'functions', (select jsonb_agg(jsonb_build_object('identity', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
    'settings', p.proconfig, 'acl', p.proacl::text,
    'definition', pg_get_functiondef(p.oid)) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'is_challenge_member', 'get_challenge_progress_summary',
      'get_group_progress_summary', 'get_provisional_group_leader_summary',
      'create_challenge_invite', 'preview_challenge_invite',
      'list_challenge_invites', 'revoke_challenge_invite', 'accept_challenge_invite',
      'prevent_challenge_ownership_change', 'prevent_participant_user_reassignment',
      'prevent_challenge_kind_change', 'prevent_personal_challenge_invites')),
  'extensions', (select jsonb_agg(jsonb_build_object('name', e.extname,
    'schema', n.nspname, 'version', e.extversion))
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'),
  'ledger_tables', (select coalesce(jsonb_agg(c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'supabase_migrations' and c.relkind in ('r', 'p'))
) as catalog;

rollback;

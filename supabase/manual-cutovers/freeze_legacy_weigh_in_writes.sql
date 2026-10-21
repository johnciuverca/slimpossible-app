-- MANUAL PRE-MIGRATION WRITE FENCE ONLY. This file is outside
-- supabase/migrations and is never run by `supabase db push`.
-- Run only in an owner-approved write-freeze window, after the backup/restore
-- rehearsal passes, and before starting the migration set that copies rows.
-- One DO statement makes REVOKE + assertions atomic, including in autocommit.
-- It is safe to repeat. It preserves legacy SELECT and DELETE privileges.

do $$
begin
  execute 'revoke insert, update on table public.weigh_ins from authenticated';

  if has_table_privilege('authenticated', 'public.weigh_ins', 'INSERT')
     or has_table_privilege('authenticated', 'public.weigh_ins', 'UPDATE') then
    raise exception
      'Legacy weigh-in fence incomplete: authenticated INSERT/UPDATE remain available through another grant.';
  end if;

  if not has_table_privilege('authenticated', 'public.weigh_ins', 'SELECT')
     or not has_table_privilege('authenticated', 'public.weigh_ins', 'DELETE') then
    raise exception
      'Legacy weigh-in fence changed the expected SELECT/DELETE contract; stop and inspect ACLs.';
  end if;
end;
$$;

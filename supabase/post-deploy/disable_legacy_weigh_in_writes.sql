-- MANUAL POST-DEPLOY CUTOVER ONLY. This file is intentionally outside
-- supabase/migrations and must not be applied by `supabase db push`.
-- Run only after the canonical app is live and its production smoke checks pass.
-- Preserve legacy reads and deletes; deny only stale-client INSERT/UPDATE.

revoke insert, update on table public.weigh_ins from authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.weigh_ins', 'INSERT')
     or has_table_privilege('authenticated', 'public.weigh_ins', 'UPDATE') then
    raise exception
      'Legacy weigh-in write cutover incomplete: authenticated INSERT/UPDATE remain available through another grant.';
  end if;
end;
$$;

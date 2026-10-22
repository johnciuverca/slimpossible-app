import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')
describe('Group chart history SQL contract', () => {
  it('adds only a fixed-search-path, authenticated, shared canonical read with stable group-specific keys', () => {
    const sql = read(
      'supabase/migrations/20261009000000_add_group_chart_history.sql',
    )
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = pg_catalog, public, auth')
    expect(sql).toContain('auth.uid() is null')
    expect(sql).toContain("viewer.status = 'active'")
    expect(sql).toContain("author.status = 'active'")
    expect(sql).toContain('personal.recorded_date <= current_date')
    expect(sql).toContain('public.personal_weigh_in_group_shares')
    expect(sql).toContain('share.challenge_id = target_challenge_id')
    expect(sql).toContain(
      "md5(target_challenge_id::text || ':' || personal.user_id::text)",
    )
    expect(sql).toContain('from public, anon')
    expect(sql).not.toMatch(/\b(insert|update|delete|alter table)\b/i)
    const returns = sql.slice(
      sql.indexOf('returns table'),
      sql.indexOf('language plpgsql'),
    )
    expect(returns).not.toMatch(/note|email|user_id|participant_id/)
    expect(sql).not.toContain('get_provisional_group_leader')
  })
  it('ships a rollback-only canonical staging harness and data-preserving inverse', () => {
    const harness = read('supabase/tests/group_chart_history_authorization.sql')
    expect(harness.trim()).toMatch(/rollback;$/)
    expect(harness).toContain('REPLACE_OWNER_UUID')
    expect(harness).toContain(
      'Three distinct existing approved disposable Auth users',
    )
    expect(harness).toContain('duplicate_names_distinct_member_keys')
    expect(harness).toContain('withdrawn_author_rows_hidden')
    expect(harness).toContain('existing_entries_and_shares_unchanged')
    expect(harness).toContain('No unused fixture dates available')
    expect(harness).not.toMatch(/save_personal_weigh_in\(null/)
    expect(harness.indexOf('No unused fixture dates available')).toBeLessThan(
      harness.indexOf('insert into public.profiles'),
    )
    expect(harness).toContain('passed is distinct from true')
    const rollback = read(
      'supabase/rollback/20261009000000_add_group_chart_history.sql',
    )
    expect(rollback).toContain(
      'drop function if exists public.get_group_chart_history(uuid)',
    )
    expect(rollback).not.toMatch(/drop table|delete from/)
  })
})

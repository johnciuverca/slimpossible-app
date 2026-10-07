import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261007000000_personal_weigh_ins.sql',
  ),
  'utf8',
)
const inventory = readFileSync(
  resolve(
    process.cwd(),
    'supabase/verification/issue_210_legacy_duplicate_inventory.sql',
  ),
  'utf8',
)
const authorizationHarness = readFileSync(
  resolve(process.cwd(), 'supabase/tests/personal_weigh_in_authorization.sql'),
  'utf8',
)
const rollback = readFileSync(
  resolve(
    process.cwd(),
    'supabase/rollback/20261007000000_restore_pre_210_rpcs.sql',
  ),
  'utf8',
)

describe('personal weigh-in migration contract', () => {
  it('stops before data conversion when one user has duplicate legacy dates', () => {
    const guard = migration.indexOf(
      'duplicate user/date rows need owner review',
    )
    const firstCreate = migration.indexOf(
      'create table public.personal_weigh_ins',
    )
    const firstCopy = migration.indexOf('insert into public.personal_weigh_ins')
    expect(guard).toBeGreaterThanOrEqual(0)
    expect(firstCreate).toBeGreaterThan(guard)
    expect(firstCopy).toBeGreaterThan(guard)
    expect(migration).toMatch(
      /group by participant\.user_id, weigh_in\.recorded_date\s+having count\(\*\) > 1/i,
    )
  })

  it('copies legacy notes and only explicit group-sharing intent without deleting sources', () => {
    expect(migration).toMatch(
      /weigh_in\.note, weigh_in\.created_at, weigh_in\.updated_at/,
    )
    expect(migration).toContain('weigh_in.share_with_group')
    expect(migration).toContain('where mapping.legacy_share_with_group')
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.weigh_ins/i)
    expect(migration).not.toMatch(/\bdrop\s+table\s+public\.weigh_ins/i)
    expect(migration).toMatch(/unique \(user_id, recorded_date\)/i)
  })

  it('makes personal writes atomic and owner-authorized, and exposes no group note', () => {
    const historyStart = migration.indexOf(
      'create or replace function public.get_group_weigh_in_history',
    )
    const historyEnd = migration.indexOf(
      '-- Group aggregates consume only',
      historyStart,
    )
    const groupHistory = migration.slice(historyStart, historyEnd)
    expect(migration).toContain(
      'create or replace function public.save_personal_weigh_in',
    )
    expect(migration).toContain('where current_entry.id = target_weigh_in_id')
    expect(migration).toContain('and current_entry.user_id = actor_id')
    expect(migration).toContain(
      'delete from public.personal_weigh_in_group_shares',
    )
    expect(migration).toContain(
      'create or replace function public.delete_personal_weigh_in',
    )
    expect(groupHistory).toContain('display_name text')
    expect(groupHistory).toContain('change_since_previous_kg numeric')
    expect(groupHistory).not.toContain('note text')
    expect(groupHistory).toContain('personal_weigh_in_group_shares')
    expect(migration).toContain('target_current_sunday - 7')
    expect(migration).toContain('baseline_date := week_start - 1')
    expect(migration).toMatch(
      /revoke all on function public\.save_personal_weigh_in[\s\S]*?from public, anon/i,
    )
    expect(migration).toMatch(
      /grant execute on function public\.save_personal_weigh_in[\s\S]*?to authenticated/i,
    )
  })

  it('provides an owner-run duplicate inventory that never selects private notes', () => {
    expect(inventory).toContain('begin transaction read only')
    expect(inventory).toContain('count(distinct weigh_in.weight_kg)')
    expect(inventory).toContain('count(distinct weigh_in.note)')
    expect(inventory).toContain('rollback;')
    expect(inventory).not.toMatch(/select\s+weigh_in\.note\s*,/i)
  })

  it('includes rollback-only server authorization checks for sharing and deletion', () => {
    expect(authorizationHarness).toContain('array[group_one, group_two]')
    expect(authorizationHarness).toContain(
      'cross_group_share_denied_atomically',
    )
    expect(authorizationHarness).toContain('outsider_denied')
    expect(authorizationHarness).toContain('other_user_delete_denied')
    expect(authorizationHarness).toContain('delete_cascades_group_shares')
    expect(authorizationHarness).toContain(
      'withdrawn_member_cannot_read_group_history',
    )
    expect(authorizationHarness).toContain(
      'anonymous_cannot_read_raw_share_rows',
    )
    expect(authorizationHarness).toContain(
      'unauthorized_delete_leaves_live_entry_intact',
    )
    expect(authorizationHarness).toContain('<> 24')
    expect(authorizationHarness.trimEnd().endsWith('rollback;')).toBe(true)
  })

  it('provides a non-destructive inverse that restores replaced RPCs', () => {
    expect(rollback).toContain(
      'create or replace function public.get_group_weigh_in_history',
    )
    expect(rollback).toContain(
      'create or replace function public.get_group_progress_summary',
    )
    expect(rollback).toContain(
      'create or replace function public.get_provisional_group_leader_summary',
    )
    expect(rollback).toContain(
      'create or replace function public.get_challenge_progress_summary',
    )
    expect(rollback).toMatch(/deliberately does NOT\s+-- drop canonical tables/)
    expect(rollback).not.toMatch(/\bdrop\s+(table|function)\b/i)
    expect(rollback.trimEnd().endsWith('commit;')).toBe(true)
  })

  it('keeps migrated summaries and provisional leaders bounded by server dates', () => {
    expect(migration).toContain(
      'personal.recorded_date <= target_current_sunday',
    )
    expect(migration).toContain('target_current_sunday > current_date')
    expect(migration).toContain('target_current_date > current_date')
    expect(migration).toContain('personal.recorded_date <= current_date')
    expect(authorizationHarness).toContain(
      'group_summary_uses_only_dates_through_selected_sunday',
    )
    expect(authorizationHarness).toContain(
      'owner_challenge_summary_excludes_future_copied_row',
    )
    expect(authorizationHarness).toContain(
      'future_provisional_summary_date_rejected',
    )
  })
})

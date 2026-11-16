import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261116000000_anonymize_weekly_awards_on_account_deletion.sql',
  ),
  'utf8',
)
const edgeFunction = readFileSync(
  resolve(process.cwd(), 'supabase/functions/delete-account/index.ts'),
  'utf8',
)

describe('account erasure preserves anonymous weekly awards', () => {
  it('scrubs identities and detailed evidence while leaving aggregate result counts intact', () => {
    expect(migration).toContain('before delete on auth.users')
    expect(migration).toContain("display_name = 'Deleted member'")
    expect(migration).toContain('member_key = null')
    expect(migration).toContain('weight_change_kg = null')
    expect(migration).toContain('baseline_before_weight_kg = null')
    expect(migration).toContain('baseline_after_weight_kg = null')
    expect(migration).toContain("sole_participant_name = 'Deleted member'")
    expect(migration).not.toContain('set winner_count =')
    expect(migration).toContain('delete from public.group_weekly_candidates')
  })

  it('removes all profile avatar objects before asking Auth to delete the caller', () => {
    const removeIndex = edgeFunction.indexOf('bucket.remove(paths)')
    const deleteIndex = edgeFunction.indexOf('admin.auth.admin.deleteUser')
    expect(edgeFunction).toContain('caller.auth.getUser()')
    expect(edgeFunction).toContain("admin.storage.from('profile-avatars')")
    expect(edgeFunction).toMatch(/await bucket\.list\(\s*userData\.user\.id/)
    expect(removeIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(removeIndex)
    expect(edgeFunction).not.toContain('request.json()')
  })
})

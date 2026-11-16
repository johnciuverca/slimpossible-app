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
const edgeHandler = readFileSync(
  resolve(process.cwd(), 'supabase/functions/delete-account/handler.ts'),
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
    expect(migration).toContain('profile_avatar_upload_allowed()')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).not.toContain('actor_is_active_member')
    expect(migration).toContain(
      'challenge_row.owner_id is distinct from actor_id',
    )
  })

  it('authenticates the caller and cleans Storage before deleting that Auth user', () => {
    const beginIndex = edgeHandler.indexOf('services.beginErasure(user.id)')
    const removeIndex = edgeHandler.indexOf(
      'if (!(await removeAvatarTree(services, user.id)))',
    )
    const deleteIndex = edgeHandler.indexOf('services.deleteAuthUser(user.id)')
    expect(edgeFunction).toMatch(
      /callerFor\(authorization\)\.auth\.getUser\(\)/,
    )
    expect(edgeFunction).toContain("storage.from('profile-avatars')")
    expect(edgeFunction).toMatch(
      /rpc\('begin_account_erasure',\s*\{\s*target_user_id: userId/,
    )
    expect(edgeHandler).not.toContain('request.json()')
    expect(beginIndex).toBeGreaterThan(-1)
    expect(removeIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(removeIndex)
    expect(beginIndex).toBeLessThan(removeIndex)
  })
})

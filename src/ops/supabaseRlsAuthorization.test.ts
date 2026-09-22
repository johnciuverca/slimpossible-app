import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const authorizationTest = readFileSync(
  resolve(process.cwd(), 'supabase/tests/rls_authorization.sql'),
  'utf8',
)

describe('Supabase RLS authorization test harness', () => {
  it('covers every required identity boundary', () => {
    for (const check of [
      'anonymous_cannot_read_challenges',
      'owner_can_read_owned_challenge',
      'member_can_read_required_challenge_metadata',
      'unrelated_cannot_read_weigh_in',
      'owner_cannot_reassign_member_with_weigh_ins',
    ]) {
      expect(authorizationTest).toContain(check)
    }
  })

  it('documents redacted output and disposable fixture cleanup', () => {
    expect(authorizationTest).toContain('returns only check names and')
    expect(authorizationTest).toContain('pass/fail details')
    expect(authorizationTest).toContain('delete from public.challenges as c')
    expect(authorizationTest).toContain('drop table slimpossible_rls_results')
    expect(authorizationTest).not.toContain('select email')
  })
})

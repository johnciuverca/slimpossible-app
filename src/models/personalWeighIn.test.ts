import { describe, expect, it } from 'vitest'

import {
  personalWeighInToday,
  validatePersonalWeighIn,
} from './personalWeighIn'

describe('validatePersonalWeighIn', () => {
  it('uses the local calendar date rather than the UTC date boundary', () => {
    expect(personalWeighInToday(new Date(2026, 9, 7))).toBe('2026-10-07')
  })

  it('accepts a private entry without a challenge', () => {
    expect(
      validatePersonalWeighIn(
        {
          date: '2026-10-07',
          note: 'private',
          sharedChallengeIds: [],
          weightKg: 82.4,
        },
        '2026-10-07',
      ),
    ).toMatchObject({ success: true })
  })

  it('rejects malformed dates, future dates, invalid weights, and duplicate shares', () => {
    const result = validatePersonalWeighIn(
      {
        date: '2026-02-30',
        sharedChallengeIds: ['group-1', 'group-1'],
        weightKg: 0,
      },
      '2026-10-07',
    )
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues.map(({ field }) => field)).toEqual(
      expect.arrayContaining(['date', 'weightKg', 'sharedChallengeIds']),
    )
  })
})

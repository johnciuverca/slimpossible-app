import { describe, expect, it } from 'vitest'

import {
  parsePersonalWeighInWeight,
  personalWeighInToday,
  validatePersonalWeighIn,
} from './personalWeighIn'

describe('validatePersonalWeighIn', () => {
  it('parses comma and dot decimals strictly at the save boundary', () => {
    expect(parsePersonalWeighInWeight('89,5')).toBe(89.5)
    expect(parsePersonalWeighInWeight('89.5')).toBe(89.5)
    expect(parsePersonalWeighInWeight('89,')).toBe(89)
    for (const value of [
      '',
      '89,5.2',
      '89.5,2',
      '89,,5',
      '1,234',
      '89kg',
      '0',
      'Infinity',
    ]) {
      expect(parsePersonalWeighInWeight(value), value).toBeNull()
    }
  })

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

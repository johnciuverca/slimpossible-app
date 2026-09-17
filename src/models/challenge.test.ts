import { describe, expect, it } from 'vitest'

import { validateChallenge } from './challenge'
import { challengeFixture } from './fixtures'

describe('validateChallenge', () => {
  it('accepts a complete challenge and optional target omission', () => {
    const result = validateChallenge({
      ...challengeFixture,
      targetWeightKg: undefined,
    })

    expect(result).toEqual({
      data: { ...challengeFixture, targetWeightKg: undefined },
      success: true,
    })
  })

  it('rejects missing identity and ownership fields', () => {
    const result = validateChallenge({
      ...challengeFixture,
      createdBy: '',
      id: '',
      name: '',
      ownerId: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map(({ field }) => field)).toEqual([
        'id',
        'name',
        'ownerId',
        'createdBy',
      ])
    }
  })

  it('rejects invalid dates, reversed ranges, and unknown status', () => {
    const invalidDateResult = validateChallenge({
      ...challengeFixture,
      endDate: '2026-02-30',
      status: 'paused',
    })

    expect(invalidDateResult.success).toBe(false)
    if (!invalidDateResult.success) {
      expect(invalidDateResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'endDate' }),
          expect.objectContaining({ field: 'status' }),
        ]),
      )
    }

    const reversedRangeResult = validateChallenge({
      ...challengeFixture,
      endDate: '2026-12-31',
      startDate: '2027-01-01',
    })

    expect(reversedRangeResult.success).toBe(false)
    if (!reversedRangeResult.success) {
      expect(reversedRangeResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'endDate' })]),
      )
    }
  })

  it('rejects invalid target and audit timestamps', () => {
    const result = validateChallenge({
      ...challengeFixture,
      createdAt: 'not-a-date',
      targetWeightKg: 0,
      updatedAt: '2026-09-15',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'targetWeightKg' }),
          expect.objectContaining({ field: 'createdAt' }),
          expect.objectContaining({ field: 'updatedAt' }),
        ]),
      )
    }
  })
})

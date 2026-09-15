import { describe, expect, it } from 'vitest'

import { validateChallenge } from './challenge'

const validChallenge = {
  createdAt: '2026-09-15T08:00:00.000Z',
  createdBy: 'user-owner',
  description: 'A shared sustainable progress challenge.',
  endDate: '2027-09-15',
  id: 'challenge-1',
  name: 'Slimpossible 2026',
  ownerId: 'user-owner',
  startDate: '2026-09-15',
  status: 'draft',
  targetWeightKg: 80.5,
  updatedAt: '2026-09-15T08:00:00.000Z',
}

describe('validateChallenge', () => {
  it('accepts a complete challenge and optional target omission', () => {
    const result = validateChallenge({
      ...validChallenge,
      targetWeightKg: undefined,
    })

    expect(result).toEqual({
      data: { ...validChallenge, targetWeightKg: undefined },
      success: true,
    })
  })

  it('rejects missing identity and ownership fields', () => {
    const result = validateChallenge({
      ...validChallenge,
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
      ...validChallenge,
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
      ...validChallenge,
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
      ...validChallenge,
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

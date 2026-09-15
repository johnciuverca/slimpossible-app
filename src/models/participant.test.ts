import { describe, expect, it } from 'vitest'

import { validateParticipant } from './participant'
import { participantFixture } from './fixtures'

describe('validateParticipant', () => {
  it('accepts a participant with challenge membership and weight goals', () => {
    const result = validateParticipant(participantFixture)

    expect(result).toEqual({
      data: participantFixture,
      success: true,
    })
  })

  it('accepts an invited participant before they join', () => {
    const result = validateParticipant({
      ...participantFixture,
      joinedAt: undefined,
      status: 'invited',
    })

    expect(result).toEqual({
      data: { ...participantFixture, joinedAt: undefined, status: 'invited' },
      success: true,
    })
  })

  it('rejects missing identity and membership fields', () => {
    const result = validateParticipant({
      ...participantFixture,
      challengeId: '',
      displayName: '',
      id: '',
      userId: '',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map(({ field }) => field)).toEqual([
        'id',
        'challengeId',
        'userId',
        'displayName',
      ])
    }
  })

  it('rejects invalid values, reversed weight goals, and unknown status', () => {
    const result = validateParticipant({
      ...participantFixture,
      joinedAt: 'not-a-date',
      startingWeightKg: 0,
      status: 'paused',
      targetWeightKg: 0,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'status' }),
          expect.objectContaining({ field: 'startingWeightKg' }),
          expect.objectContaining({ field: 'targetWeightKg' }),
          expect.objectContaining({ field: 'joinedAt' }),
        ]),
      )
    }

    const reversedGoalResult = validateParticipant({
      ...participantFixture,
      targetWeightKg: 100,
    })

    expect(reversedGoalResult.success).toBe(false)
    if (!reversedGoalResult.success) {
      expect(reversedGoalResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'targetWeightKg' }),
        ]),
      )
    }
  })

  it('requires a join time for participants beyond invited status', () => {
    const result = validateParticipant({
      ...participantFixture,
      joinedAt: undefined,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'joinedAt' }),
        ]),
      )
    }
  })
})

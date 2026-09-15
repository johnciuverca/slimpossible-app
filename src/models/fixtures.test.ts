import { describe, expect, it } from 'vitest'

import { validateChallenge } from './challenge'
import {
  challengeFixture,
  createChallengeFixture,
  createParticipantFixture,
  participantFixture,
} from './fixtures'
import { validateParticipant } from './participant'

describe('local model fixtures', () => {
  it('creates valid challenge and participant defaults', () => {
    expect(validateChallenge(createChallengeFixture())).toEqual({
      data: challengeFixture,
      success: true,
    })
    expect(validateParticipant(createParticipantFixture())).toEqual({
      data: participantFixture,
      success: true,
    })
  })

  it('supports deterministic overrides without mutating shared defaults', () => {
    const challenge = createChallengeFixture({
      id: 'challenge-2',
      status: 'active',
    })
    const participant = createParticipantFixture({
      displayName: 'Sam Participant',
      id: 'participant-2',
    })

    expect(challenge).toMatchObject({ id: 'challenge-2', status: 'active' })
    expect(participant).toMatchObject({
      displayName: 'Sam Participant',
      id: 'participant-2',
    })
    expect(challengeFixture.id).toBe('challenge-1')
    expect(participantFixture.displayName).toBe('Alex Participant')
  })

  it('covers malformed challenge inputs and boundary dates', () => {
    expect(validateChallenge(null).success).toBe(false)
    expect(
      validateChallenge(
        createChallengeFixture({
          endDate: '2026-04-31',
          name: '   ',
        }),
      ),
    ).toMatchObject({
      success: false,
    })

    const result = validateChallenge(
      createChallengeFixture({ description: 42 as unknown as string }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'description' }),
        ]),
      )
    }
  })

  it('covers participant number, status, and membership edge cases', () => {
    expect(validateParticipant(undefined).success).toBe(false)

    const invalidNumberResult = validateParticipant(
      createParticipantFixture({
        startingWeightKg: Number.NaN,
        targetWeightKg: Number.POSITIVE_INFINITY,
      }),
    )
    expect(invalidNumberResult.success).toBe(false)
    if (!invalidNumberResult.success) {
      expect(invalidNumberResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'startingWeightKg' }),
          expect.objectContaining({ field: 'targetWeightKg' }),
        ]),
      )
    }

    expect(
      validateParticipant(
        createParticipantFixture({ joinedAt: undefined, status: 'invited' }),
      ).success,
    ).toBe(true)
    expect(
      validateParticipant(
        createParticipantFixture({ joinedAt: undefined, status: 'completed' }),
      ).success,
    ).toBe(false)
  })
})

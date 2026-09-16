import { describe, expect, it } from 'vitest'

import { createParticipantFixture } from './fixtures'
import { determineWeeklyProgressEligibility } from './weeklyProgressEligibility'
import type { WeeklyProgressEligibilityInput } from './weeklyProgressEligibility'

const previousSunday = '2026-09-13'
const currentSunday = '2026-09-20'

function createInput(
  overrides: Partial<WeeklyProgressEligibilityInput> = {},
): WeeklyProgressEligibilityInput {
  return {
    challengeId: 'challenge-1',
    challengeScope: 'group',
    currentSunday,
    participants: [],
    previousSunday,
    weighIns: [],
    ...overrides,
  }
}

describe('determineWeeklyProgressEligibility', () => {
  it('returns no eligible participants when the group has no records', () => {
    const participant = createParticipantFixture({ id: 'participant-ava' })

    expect(
      determineWeeklyProgressEligibility(
        createInput({ participants: [participant] }),
      ),
    ).toEqual({
      activeParticipantCount: 1,
      candidates: [],
      currentSunday,
      previousSunday,
      state: 'no-eligible-participants',
    })
  })

  it('uses only exact Sunday records to produce a candidate change', () => {
    const participant = createParticipantFixture({ id: 'participant-ava' })

    expect(
      determineWeeklyProgressEligibility(
        createInput({
          participants: [participant],
          weighIns: [
            {
              date: previousSunday,
              participantId: participant.id,
              weightKg: 100,
            },
            {
              date: currentSunday,
              participantId: participant.id,
              weightKg: 95,
            },
          ],
        }),
      ),
    ).toEqual({
      activeParticipantCount: 1,
      candidates: [
        { participantId: 'participant-ava', weeklyWeightChangeKg: -5 },
      ],
      currentSunday,
      previousSunday,
      state: 'eligible-candidates',
    })
  })

  it('does not substitute nearby dates when an exact Sunday is missing', () => {
    const participant = createParticipantFixture({ id: 'participant-ava' })

    expect(
      determineWeeklyProgressEligibility(
        createInput({
          participants: [participant],
          weighIns: [
            {
              date: previousSunday,
              participantId: participant.id,
              weightKg: 100,
            },
            {
              date: '2026-09-19',
              participantId: participant.id,
              weightKg: 95,
            },
          ],
        }),
      ),
    ).toMatchObject({
      candidates: [],
      state: 'no-eligible-participants',
    })
  })

  it('allows partial group participation without blocking eligible candidates', () => {
    const firstParticipant = createParticipantFixture({ id: 'participant-ava' })
    const secondParticipant = createParticipantFixture({
      id: 'participant-ben',
    })
    const thirdParticipant = createParticipantFixture({
      id: 'participant-casey',
    })
    const fourthParticipant = createParticipantFixture({
      id: 'participant-dee',
    })

    expect(
      determineWeeklyProgressEligibility(
        createInput({
          participants: [
            firstParticipant,
            secondParticipant,
            thirdParticipant,
            fourthParticipant,
          ],
          weighIns: [
            {
              date: previousSunday,
              participantId: firstParticipant.id,
              weightKg: 100,
            },
            {
              date: currentSunday,
              participantId: firstParticipant.id,
              weightKg: 95,
            },
            {
              date: previousSunday,
              participantId: secondParticipant.id,
              weightKg: 80,
            },
            {
              date: currentSunday,
              participantId: secondParticipant.id,
              weightKg: 82,
            },
            {
              date: currentSunday,
              participantId: thirdParticipant.id,
              weightKg: 70,
            },
            {
              date: previousSunday,
              participantId: fourthParticipant.id,
              weightKg: 90,
            },
          ],
        }),
      ),
    ).toMatchObject({
      activeParticipantCount: 4,
      candidates: [
        { participantId: firstParticipant.id, weeklyWeightChangeKg: -5 },
        { participantId: secondParticipant.id, weeklyWeightChangeKg: 2 },
      ],
      state: 'eligible-candidates',
    })
  })

  it('recalculates candidates when a late required Sunday record is added', () => {
    const participant = createParticipantFixture({ id: 'participant-ava' })
    const input = createInput({
      participants: [participant],
      weighIns: [
        {
          date: previousSunday,
          participantId: participant.id,
          weightKg: 100,
        },
      ],
    })

    expect(determineWeeklyProgressEligibility(input)).toMatchObject({
      candidates: [],
      state: 'no-eligible-participants',
    })
    expect(
      determineWeeklyProgressEligibility({
        ...input,
        weighIns: [
          ...input.weighIns,
          {
            date: currentSunday,
            participantId: participant.id,
            weightKg: 95,
          },
        ],
      }),
    ).toMatchObject({
      candidates: [{ participantId: participant.id, weeklyWeightChangeKg: -5 }],
      state: 'eligible-candidates',
    })
  })

  it('keeps raw weights, notes, and display details outside the candidate result', () => {
    const participant = createParticipantFixture({
      displayName: 'Ava Private',
      id: 'participant-ava',
    })
    const result = determineWeeklyProgressEligibility(
      createInput({
        participants: [participant],
        weighIns: [
          {
            date: previousSunday,
            note: 'Private note',
            participantId: participant.id,
            weightKg: 100,
          },
          {
            date: currentSunday,
            participantId: participant.id,
            weightKg: 95,
          },
        ],
      }),
    )

    expect(result.candidates[0]).not.toHaveProperty('weightKg')
    expect(result.candidates[0]).not.toHaveProperty('displayName')
    expect(result.candidates[0]).not.toHaveProperty('note')
    expect(JSON.stringify(result)).not.toContain('Ava Private')
    expect(JSON.stringify(result)).not.toContain('Private note')
    expect(JSON.stringify(result)).not.toContain('100')
  })

  it('keeps weekly progress unavailable outside group challenges', () => {
    expect(
      determineWeeklyProgressEligibility(
        createInput({ challengeScope: 'individual' }),
      ),
    ).toMatchObject({
      candidates: [],
      state: 'not-group-challenge',
    })
  })
})

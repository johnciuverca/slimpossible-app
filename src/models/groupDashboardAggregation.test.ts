import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createGroupDashboardAggregation } from './groupDashboardAggregation'

describe('createGroupDashboardAggregation', () => {
  it('aggregates completion from active participants with recorded progress only', () => {
    const firstParticipant = createParticipantFixture({
      id: 'participant-1',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const secondParticipant = createParticipantFixture({
      id: 'participant-2',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const inactiveParticipant = createParticipantFixture({
      id: 'participant-inactive',
      status: 'completed',
    })
    const otherChallengeParticipant = createParticipantFixture({
      challengeId: 'another-challenge',
      id: 'participant-other-challenge',
    })

    expect(
      createGroupDashboardAggregation({
        challenge: challengeFixture,
        participants: [
          firstParticipant,
          secondParticipant,
          inactiveParticipant,
          otherChallengeParticipant,
        ],
        weighIns: [
          {
            date: '2026-09-15',
            participantId: firstParticipant.id,
            weightKg: 90,
          },
          {
            date: '2026-09-15',
            participantId: secondParticipant.id,
            weightKg: 80,
          },
          {
            date: '2026-09-15',
            participantId: inactiveParticipant.id,
            weightKg: 70,
          },
        ],
      }),
    ).toEqual({
      activeParticipantCount: 2,
      averageCompletionPercentage: 75,
      completionState: 'available',
      participantsWithProgressCount: 2,
      participantsWithRecordedWeightCount: 2,
      reachedTargetCount: 1,
      state: 'ready',
    })
  })

  it('returns an explicit empty state when the challenge has no active participants', () => {
    expect(
      createGroupDashboardAggregation({
        challenge: challengeFixture,
        participants: [createParticipantFixture({ status: 'invited' })],
        weighIns: [],
      }),
    ).toEqual({
      activeParticipantCount: 0,
      averageCompletionPercentage: null,
      completionState: 'unavailable',
      participantsWithProgressCount: 0,
      participantsWithRecordedWeightCount: 0,
      reachedTargetCount: 0,
      state: 'empty',
    })
  })

  it('keeps a group with no recorded weights unavailable rather than inventing progress', () => {
    expect(
      createGroupDashboardAggregation({
        challenge: challengeFixture,
        participants: [
          createParticipantFixture({ id: 'participant-1' }),
          createParticipantFixture({ id: 'participant-2' }),
        ],
        weighIns: [],
      }),
    ).toEqual({
      activeParticipantCount: 2,
      averageCompletionPercentage: null,
      completionState: 'unavailable',
      participantsWithProgressCount: 0,
      participantsWithRecordedWeightCount: 0,
      reachedTargetCount: 0,
      state: 'no-records',
    })
  })

  it('keeps completion unavailable when recorded participants have no targets', () => {
    expect(
      createGroupDashboardAggregation({
        challenge: challengeFixture,
        participants: [createParticipantFixture({ targetWeightKg: undefined })],
        weighIns: [
          { date: '2026-09-15', participantId: 'participant-1', weightKg: 90 },
        ],
      }),
    ).toEqual({
      activeParticipantCount: 1,
      averageCompletionPercentage: null,
      completionState: 'unavailable',
      participantsWithProgressCount: 0,
      participantsWithRecordedWeightCount: 1,
      reachedTargetCount: 0,
      state: 'ready',
    })
  })

  it('does not expose participant identities, raw weights, or individual dashboards', () => {
    const aggregation = createGroupDashboardAggregation({
      challenge: challengeFixture,
      participants: [createParticipantFixture()],
      weighIns: [
        { date: '2026-09-15', participantId: 'participant-1', weightKg: 90 },
      ],
    })

    expect(aggregation).not.toHaveProperty('participants')
    expect(aggregation).not.toHaveProperty('weighIns')
    expect(aggregation).not.toHaveProperty('dashboards')
    expect(JSON.stringify(aggregation)).not.toContain('participant-1')
    expect(JSON.stringify(aggregation)).not.toContain('90')
  })
})

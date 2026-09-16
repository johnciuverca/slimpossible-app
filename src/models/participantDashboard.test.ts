import { describe, expect, it } from 'vitest'

import {
  challengeFixture,
  createParticipantFixture,
  participantFixture,
} from './fixtures'
import { createParticipantDashboardView } from './participantDashboard'
import type { WeighIn } from './weighIn'

const weighIns: readonly WeighIn[] = [
  {
    date: '2026-09-15',
    participantId: participantFixture.id,
    weightKg: 90,
  },
  {
    date: '2026-09-16',
    participantId: participantFixture.id,
    weightKg: 88,
  },
  {
    date: '2026-09-16',
    participantId: 'another-participant',
    weightKg: 70,
  },
]

describe('createParticipantDashboardView', () => {
  it('composes the latest record and Chapter 6 progress for a participant', () => {
    expect(
      createParticipantDashboardView({
        challenge: challengeFixture,
        participantId: participantFixture.id,
        participants: [participantFixture],
        weighIns,
      }),
    ).toMatchObject({
      completionPercentage: 36,
      currentWeightKg: 88,
      dailyChangeKg: -2,
      latestWeighIn: {
        date: '2026-09-16',
        participantId: participantFixture.id,
        weightKg: 88,
      },
      participant: participantFixture,
      progress: {
        completionPercentage: 36,
        direction: 'loss',
        remainingKg: 8,
        state: 'target-set',
      },
      progressState: { direction: 'loss', state: 'in-progress' },
      remainingTargetWeightKg: 8,
      startingWeightKg: 92.5,
      state: 'ready',
      targetWeightKg: 80,
      totalChangeKg: -4.5,
    })
  })

  it('keeps no-records data explicit without inventing a current weight', () => {
    expect(
      createParticipantDashboardView({
        challenge: challengeFixture,
        participantId: participantFixture.id,
        participants: [participantFixture],
        weighIns: [],
      }),
    ).toMatchObject({
      currentWeightKg: null,
      dailyChangeKg: null,
      latestWeighIn: null,
      progressState: { direction: null, state: 'no-target' },
      remainingTargetWeightKg: null,
      startingWeightKg: 92.5,
      state: 'no-records',
      targetWeightKg: 80,
      totalChangeKg: null,
    })
  })

  it('represents a missing participant safely within the selected challenge', () => {
    expect(
      createParticipantDashboardView({
        challenge: challengeFixture,
        participantId: 'missing-participant',
        participants: [participantFixture],
        weighIns,
      }),
    ).toMatchObject({
      currentWeightKg: null,
      participant: null,
      progressState: { direction: null, state: 'no-target' },
      startingWeightKg: null,
      state: 'participant-not-found',
      targetWeightKg: null,
    })
  })

  it('keeps an incomplete participant profile in an explicit no-target state', () => {
    const participantWithoutTarget = createParticipantFixture({
      targetWeightKg: undefined,
    })

    expect(
      createParticipantDashboardView({
        challenge: challengeFixture,
        participantId: participantWithoutTarget.id,
        participants: [participantWithoutTarget],
        weighIns,
      }),
    ).toMatchObject({
      completionPercentage: null,
      currentWeightKg: 88,
      progress: {
        completionPercentage: null,
        direction: null,
        remainingKg: null,
        state: 'no-target',
      },
      progressState: { direction: null, state: 'no-target' },
      remainingTargetWeightKg: null,
      state: 'ready',
      targetWeightKg: null,
    })
  })
})

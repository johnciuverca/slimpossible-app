import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createParticipantDashboardView } from './participantDashboard'
import { createParticipantProgressSummary } from './participantProgressSummary'
import type { WeighIn } from './weighIn'

function createDashboard(
  participant = createParticipantFixture(),
  weighIns: readonly WeighIn[] = [],
) {
  return createParticipantDashboardView({
    challenge: challengeFixture,
    participantId: participant.id,
    participants: [participant],
    weighIns,
  })
}

describe('createParticipantProgressSummary', () => {
  it('summarizes an in-progress loss goal with supportive copy', () => {
    const participant = createParticipantFixture()
    const summary = createParticipantProgressSummary(
      createDashboard(participant, [
        { date: '2026-09-16', participantId: participant.id, weightKg: 88 },
      ]),
    )

    expect(summary).toMatchObject({
      completionPercentage: 36,
      currentWeightKg: 88,
      direction: 'loss',
      goalLabel: 'Weight loss goal',
      message: 'You are 8 kg away from your target weight.',
      remainingTargetWeightKg: 8,
      state: 'in-progress',
      statusLabel: 'In progress',
      totalChangeKg: -4.5,
    })
  })

  it('summarizes an in-progress gain goal with the same progress semantics', () => {
    const participant = createParticipantFixture({
      startingWeightKg: 70,
      targetWeightKg: 80,
    })
    const summary = createParticipantProgressSummary(
      createDashboard(participant, [
        { date: '2026-09-16', participantId: participant.id, weightKg: 75 },
      ]),
    )

    expect(summary).toMatchObject({
      completionPercentage: 50,
      direction: 'gain',
      goalLabel: 'Weight gain goal',
      message: 'You are 5 kg away from your target weight.',
      remainingTargetWeightKg: 5,
      state: 'in-progress',
    })
  })

  it('supports an exact maintain goal as a reached target', () => {
    const participant = createParticipantFixture({ targetWeightKg: 92.5 })
    const summary = createParticipantProgressSummary(
      createDashboard(participant, [
        {
          date: '2026-09-16',
          participantId: participant.id,
          weightKg: 92.5,
        },
      ]),
    )

    expect(summary).toMatchObject({
      completionPercentage: 100,
      direction: 'maintain',
      goalLabel: 'Maintain weight goal',
      message: 'You have reached your target weight.',
      remainingTargetWeightKg: 0,
      state: 'target-reached',
      statusLabel: 'Target reached',
    })
  })

  it('keeps the first-record state explicit', () => {
    expect(createParticipantProgressSummary(createDashboard())).toMatchObject({
      completionPercentage: null,
      currentWeightKg: null,
      direction: null,
      message: 'Record your first weigh-in to see progress toward your target.',
      state: 'first-record',
      statusLabel: 'First weigh-in needed',
    })
  })

  it('keeps an incomplete participant profile in a no-target state', () => {
    const participant = createParticipantFixture({ targetWeightKg: undefined })
    const summary = createParticipantProgressSummary(
      createDashboard(participant, [
        { date: '2026-09-16', participantId: participant.id, weightKg: 88 },
      ]),
    )

    expect(summary).toMatchObject({
      completionPercentage: null,
      direction: null,
      message: 'Add a target weight to see your progress.',
      state: 'no-target',
      statusLabel: 'No target set',
    })
  })

  it('keeps a missing participant understandable', () => {
    const dashboard = createParticipantDashboardView({
      challenge: challengeFixture,
      participantId: 'missing-participant',
      participants: [],
      weighIns: [],
    })

    expect(createParticipantProgressSummary(dashboard)).toMatchObject({
      direction: null,
      message: 'We could not find this participant in the selected challenge.',
      state: 'participant-not-found',
      statusLabel: 'Participant not found',
    })
  })
})

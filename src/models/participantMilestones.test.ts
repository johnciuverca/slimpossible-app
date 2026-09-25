import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createParticipantDashboardView } from './participantDashboard'
import {
  createParticipantMilestones,
  milestoneThresholds,
} from './participantMilestones'
import type { ParticipantDashboardParticipant } from './participantDashboard'

function createDashboard(
  participant: ParticipantDashboardParticipant,
  currentWeightKg?: number,
) {
  return createParticipantDashboardView({
    challenge: challengeFixture,
    participantId: participant.id,
    participants: [participant],
    weighIns:
      currentWeightKg === undefined
        ? []
        : [
            {
              date: '2026-09-15',
              participantId: participant.id,
              weightKg: currentWeightKg,
            },
          ],
  })
}

describe('createParticipantMilestones', () => {
  it.each([
    [95, [25]],
    [90, [25, 50]],
    [85, [25, 50, 75]],
    [80, [25, 50, 75, 100]],
  ])(
    'reaches the expected loss-goal boundaries at %s kg',
    (currentWeightKg, reachedThresholds) => {
      const participant = createParticipantFixture({
        id: 'participant-ava',
        startingWeightKg: 100,
        targetWeightKg: 80,
      })
      const result = createParticipantMilestones(
        createDashboard(participant, currentWeightKg),
      )

      expect(result).toMatchObject({
        completionPercentage: reachedThresholds.at(-1),
        participantId: participant.id,
        state: 'available',
      })
      expect(
        result.milestones
          .filter((milestone) => milestone.state === 'reached')
          .map((milestone) => milestone.thresholdPercentage),
      ).toEqual(reachedThresholds)
    },
  )

  it('reaches every skipped lower threshold after a gain-goal overshoot', () => {
    const participant = createParticipantFixture({
      id: 'participant-ava',
      startingWeightKg: 70,
      targetWeightKg: 80,
    })

    expect(
      createParticipantMilestones(createDashboard(participant, 85)),
    ).toMatchObject({
      completionPercentage: 100,
      milestones: milestoneThresholds.map((thresholdPercentage) => ({
        id: `challenge-1:participant-ava:${thresholdPercentage}`,
        state: 'reached',
        thresholdPercentage,
      })),
      state: 'available',
    })
  })

  it('reaches the maintain-goal milestones only when the target is met', () => {
    const participant = createParticipantFixture({
      id: 'participant-ava',
      startingWeightKg: 80,
      targetWeightKg: 80,
    })

    expect(
      createParticipantMilestones(createDashboard(participant, 80)),
    ).toMatchObject({
      completionPercentage: 100,
      milestones: milestoneThresholds.map((thresholdPercentage) => ({
        state: 'reached',
        thresholdPercentage,
      })),
      state: 'available',
    })
  })

  it('recomputes reached milestones when the latest saved weigh-in is corrected', () => {
    const participant = createParticipantFixture({
      id: 'participant-ava',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })

    const beforeCorrection = createParticipantMilestones(
      createDashboard(participant, 90),
    )
    const afterCorrection = createParticipantMilestones(
      createDashboard(participant, 95),
    )

    expect(beforeCorrection).toMatchObject({ completionPercentage: 50 })
    expect(afterCorrection).toMatchObject({ completionPercentage: 25 })
    expect(
      afterCorrection.state === 'available'
        ? afterCorrection.milestones
            .filter(({ state }) => state === 'reached')
            .map(({ thresholdPercentage }) => thresholdPercentage)
        : [],
    ).toEqual([25])
  })

  it('returns stable unique entries on repeated evaluation instead of duplicates', () => {
    const participant = createParticipantFixture({
      id: 'participant-ava',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const dashboard = createDashboard(participant, 90)
    const firstEvaluation = createParticipantMilestones(dashboard)
    const secondEvaluation = createParticipantMilestones(dashboard)

    expect(secondEvaluation).toEqual(firstEvaluation)
    expect(new Set(firstEvaluation.milestones.map(({ id }) => id)).size).toBe(4)
    expect(firstEvaluation.milestones).toHaveLength(4)
  })

  it('makes no target and no recorded progress explicitly unavailable', () => {
    const noTargetParticipant = createParticipantFixture({
      id: 'participant-no-target',
      targetWeightKg: undefined,
    })
    const noRecordsParticipant = createParticipantFixture({
      id: 'participant-no-records',
    })

    expect(
      createParticipantMilestones(createDashboard(noTargetParticipant, 90)),
    ).toMatchObject({
      completionPercentage: null,
      milestones: [],
      reason: 'no-target',
      state: 'unavailable',
    })
    expect(
      createParticipantMilestones(createDashboard(noRecordsParticipant)),
    ).toMatchObject({
      completionPercentage: null,
      milestones: [],
      reason: 'no-records',
      state: 'unavailable',
    })
  })
})

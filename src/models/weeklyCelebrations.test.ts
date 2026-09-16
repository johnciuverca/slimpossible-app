import { describe, expect, it } from 'vitest'

import { createWeeklyCelebrations } from './weeklyCelebrations'
import { determineWeeklyWinners } from './weeklyWinners'
import type { ParticipantMilestones } from './participantMilestones'
import type { WeeklyProgressEligibility } from './weeklyProgressEligibility'

type AvailableMilestones = Extract<
  ParticipantMilestones,
  { state: 'available' }
>

function eligibility(
  candidates: WeeklyProgressEligibility['candidates'],
  activeParticipantCount = candidates.length,
): WeeklyProgressEligibility {
  return {
    activeParticipantCount,
    candidates,
    currentSunday: '2026-09-20',
    previousSunday: '2026-09-13',
    state:
      candidates.length > 0
        ? 'eligible-candidates'
        : 'no-eligible-participants',
  }
}

function availableMilestones(
  participantId = 'participant-ava',
): AvailableMilestones {
  return {
    challengeId: 'challenge-1',
    completionPercentage: 50,
    milestones: [
      {
        id: `challenge-1:${participantId}:25`,
        state: 'reached',
        thresholdPercentage: 25,
      },
      {
        id: `challenge-1:${participantId}:50`,
        state: 'reached',
        thresholdPercentage: 50,
      },
      {
        id: `challenge-1:${participantId}:75`,
        state: 'upcoming',
        thresholdPercentage: 75,
      },
      {
        id: `challenge-1:${participantId}:100`,
        state: 'upcoming',
        thresholdPercentage: 100,
      },
    ],
    participantId,
    state: 'available',
  }
}

describe('createWeeklyCelebrations', () => {
  it('makes unavailable weekly and milestone states explicit', () => {
    const noCandidates = eligibility([], 3)
    const unavailableMilestones: ParticipantMilestones = {
      challengeId: 'challenge-1',
      completionPercentage: null,
      milestones: [],
      participantId: 'participant-ava',
      reason: 'no-target',
      state: 'unavailable',
    }

    expect(
      createWeeklyCelebrations({
        eligibility: noCandidates,
        participantMilestones: [unavailableMilestones],
        winners: determineWeeklyWinners(noCandidates),
      }),
    ).toMatchObject({
      milestoneCelebrations: [{ reason: 'no-target', state: 'unavailable' }],
      weeklyWin: {
        activeParticipantCount: 3,
        eligibleParticipantCount: 0,
        participation: 'none',
        state: 'no-eligible-candidates',
        winnerParticipantIds: [],
      },
    })
  })

  it('presents a partial group result with one winner and no candidate list', () => {
    const partialEligibility = eligibility(
      [{ participantId: 'participant-ava', weeklyWeightChangeKg: -3 }],
      4,
    )

    expect(
      createWeeklyCelebrations({
        eligibility: partialEligibility,
        participantMilestones: [availableMilestones()],
        winners: determineWeeklyWinners(partialEligibility),
      }),
    ).toMatchObject({
      weeklyWin: {
        activeParticipantCount: 4,
        eligibleParticipantCount: 1,
        message:
          '1 weekly winner is ready. Based on 1 of 4 active participants.',
        participation: 'partial',
        state: 'single-winner',
        winnerParticipantIds: ['participant-ava'],
      },
    })
  })

  it('presents shared winners from complete participation', () => {
    const completeEligibility = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -2 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
    ])

    expect(
      createWeeklyCelebrations({
        eligibility: completeEligibility,
        participantMilestones: [
          availableMilestones('participant-ava'),
          availableMilestones('participant-ben'),
        ],
        winners: determineWeeklyWinners(completeEligibility),
      }),
    ).toMatchObject({
      weeklyWin: {
        participation: 'complete',
        state: 'shared-winners',
        winnerParticipantIds: ['participant-ava', 'participant-ben'],
      },
    })
  })

  it('recalculates the displayed winner when the source candidates change', () => {
    const beforeEdit = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -4 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
    ])
    const afterEdit = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -1 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
    ])

    expect(
      createWeeklyCelebrations({
        eligibility: beforeEdit,
        participantMilestones: [],
        winners: determineWeeklyWinners(beforeEdit),
      }).weeklyWin.winnerParticipantIds,
    ).toEqual(['participant-ava'])
    expect(
      createWeeklyCelebrations({
        eligibility: afterEdit,
        participantMilestones: [],
        winners: determineWeeklyWinners(afterEdit),
      }).weeklyWin.winnerParticipantIds,
    ).toEqual(['participant-ben'])
  })

  it('composes deduplicated reached and upcoming milestone celebration context', () => {
    const sourceMilestones = availableMilestones()
    const duplicateThreshold = {
      ...sourceMilestones.milestones[1],
      id: 'duplicated-50',
    }
    const duplicatedMilestones = {
      ...sourceMilestones,
      milestones: [...sourceMilestones.milestones, duplicateThreshold],
    }
    const sourceEligibility = eligibility([])

    const celebrations = createWeeklyCelebrations({
      eligibility: sourceEligibility,
      participantMilestones: [duplicatedMilestones, sourceMilestones],
      winners: determineWeeklyWinners(sourceEligibility),
    })

    expect(celebrations.milestoneCelebrations).toEqual([
      {
        challengeId: 'challenge-1',
        milestones: [
          { state: 'reached', thresholdPercentage: 25 },
          { state: 'reached', thresholdPercentage: 50 },
          { state: 'upcoming', thresholdPercentage: 75 },
          { state: 'upcoming', thresholdPercentage: 100 },
        ],
        participantId: 'participant-ava',
        state: 'available',
      },
    ])
  })

  it('does not expose raw data, candidate/loser changes, or unsupported rankings', () => {
    const sourceEligibility = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -2 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: 3 },
    ])
    const celebrations = createWeeklyCelebrations({
      eligibility: sourceEligibility,
      participantMilestones: [availableMilestones()],
      winners: determineWeeklyWinners(sourceEligibility),
    })
    const serialized = JSON.stringify(celebrations)

    expect(celebrations.weeklyWin).not.toHaveProperty('candidates')
    expect(celebrations.weeklyWin).not.toHaveProperty('bestWeeklyChangeKg')
    expect(celebrations.milestoneCelebrations[0]).not.toHaveProperty(
      'completionPercentage',
    )
    expect(serialized).not.toContain('participant-ben')
    expect(serialized).not.toContain('weeklyWeightChangeKg')
    expect(serialized).not.toContain('rank')
  })
})

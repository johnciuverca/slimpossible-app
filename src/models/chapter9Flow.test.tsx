import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MilestoneProgress } from '../components/MilestoneProgress'
import { challengeFixture, createParticipantFixture } from './fixtures'
import { createParticipantDashboardView } from './participantDashboard'
import { createParticipantMilestones } from './participantMilestones'
import { createWeeklyCelebrations } from './weeklyCelebrations'
import { determineWeeklyProgressEligibility } from './weeklyProgressEligibility'
import { determineWeeklyWinners } from './weeklyWinners'
import type { Participant } from './participant'
import type { WeighIn } from './weighIn'

const previousSunday = '2026-09-13'
const currentSunday = '2026-09-20'

afterEach(cleanup)

function weighIn(
  participantId: string,
  date: string,
  weightKg: number,
  note?: string,
): WeighIn {
  return { date, note, participantId, weightKg }
}

function weeklyFlow(participants: Participant[], weighIns: WeighIn[]) {
  const eligibility = determineWeeklyProgressEligibility({
    challengeId: challengeFixture.id,
    challengeScope: 'group',
    currentSunday,
    participants,
    previousSunday,
    weighIns,
  })

  return {
    eligibility,
    winners: determineWeeklyWinners(eligibility),
  }
}

function milestonesFor(participant: Participant, weighIns: readonly WeighIn[]) {
  return createParticipantMilestones(
    createParticipantDashboardView({
      challenge: challengeFixture,
      participantId: participant.id,
      participants: [participant],
      weighIns,
    }),
  )
}

describe('Chapter 9 weekly wins and milestone flow', () => {
  it('uses exact consecutive Sundays, reports partial participation, and recalculates after a late edit', () => {
    const ava = createParticipantFixture({
      id: 'participant-ava',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const ben = createParticipantFixture({
      id: 'participant-ben',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const cal = createParticipantFixture({ id: 'participant-cal' })
    const records = [
      weighIn(ava.id, previousSunday, 100),
      weighIn(ava.id, currentSunday, 95, 'private Sunday note'),
      weighIn(ava.id, '2026-09-19', 80),
      weighIn(ben.id, previousSunday, 100),
      weighIn(ben.id, currentSunday, 99),
      weighIn(cal.id, previousSunday, 90),
    ]

    const beforeEdit = weeklyFlow([ava, ben, cal], records)
    const beforeCelebrations = createWeeklyCelebrations({
      eligibility: beforeEdit.eligibility,
      participantMilestones: [milestonesFor(ava, records)],
      winners: beforeEdit.winners,
    })

    expect(beforeEdit.eligibility).toMatchObject({
      activeParticipantCount: 3,
      candidates: [
        { participantId: ava.id, weeklyWeightChangeKg: -5 },
        { participantId: ben.id, weeklyWeightChangeKg: -1 },
      ],
    })
    expect(beforeCelebrations.weeklyWin).toMatchObject({
      participation: 'partial',
      state: 'single-winner',
      winnerParticipantIds: [ava.id],
    })

    const afterEdit = weeklyFlow(
      [ava, ben, cal],
      records.map((record) =>
        record.participantId === ava.id && record.date === currentSunday
          ? { ...record, weightKg: 100 }
          : record,
      ),
    )

    expect(afterEdit.winners).toMatchObject({
      bestWeeklyChangeKg: -1,
      state: 'winner',
      winners: [{ participantId: ben.id }],
    })
  })

  it('selects maintaining progress ahead of gains and still selects the smallest gain when everyone gains', () => {
    const maintain = createParticipantFixture({ id: 'participant-maintain' })
    const gains = createParticipantFixture({ id: 'participant-gains' })
    const mixed = weeklyFlow(
      [maintain, gains],
      [
        weighIn(maintain.id, previousSunday, 80),
        weighIn(maintain.id, currentSunday, 80),
        weighIn(gains.id, previousSunday, 80),
        weighIn(gains.id, currentSunday, 82),
      ],
    )
    const allGain = weeklyFlow(
      [maintain, gains],
      [
        weighIn(maintain.id, previousSunday, 80),
        weighIn(maintain.id, currentSunday, 83),
        weighIn(gains.id, previousSunday, 80),
        weighIn(gains.id, currentSunday, 81),
      ],
    )

    expect(mixed.winners.winners).toEqual([{ participantId: maintain.id }])
    expect(allGain.winners).toMatchObject({
      bestWeeklyChangeKg: 1,
      winners: [{ participantId: gains.id }],
    })
  })

  it('presents equal lowest changes as shared winners without exposing other weekly measurements', () => {
    const ava = createParticipantFixture({ id: 'participant-ava' })
    const ben = createParticipantFixture({ id: 'participant-ben' })
    const cal = createParticipantFixture({ id: 'participant-cal' })
    const records = [
      weighIn(ava.id, previousSunday, 100),
      weighIn(ava.id, currentSunday, 98),
      weighIn(ben.id, previousSunday, 90),
      weighIn(ben.id, currentSunday, 88),
      weighIn(cal.id, previousSunday, 70),
      weighIn(cal.id, currentSunday, 74),
    ]
    const flow = weeklyFlow([ava, ben, cal], records)
    const celebrations = createWeeklyCelebrations({
      eligibility: flow.eligibility,
      participantMilestones: [],
      winners: flow.winners,
    })
    const serialized = JSON.stringify(celebrations)

    expect(celebrations.weeklyWin).toMatchObject({
      participation: 'complete',
      state: 'shared-winners',
      winnerParticipantIds: [ava.id, ben.id],
    })
    expect(serialized).not.toContain(cal.id)
    expect(serialized).not.toContain('weeklyWeightChangeKg')
    expect(serialized).not.toContain('100')
  })

  it.each([
    [95, 25, 1],
    [90, 50, 2],
    [85, 75, 3],
    [80, 100, 4],
  ])(
    'derives the %i%% milestone boundary from the participant dashboard',
    (currentWeightKg, completionPercentage, reachedCount) => {
      const participant = createParticipantFixture({
        id: `participant-${completionPercentage}`,
        startingWeightKg: 100,
        targetWeightKg: 80,
      })
      const milestones = milestonesFor(participant, [
        weighIn(participant.id, currentSunday, currentWeightKg),
      ])

      expect(milestones).toMatchObject({
        completionPercentage,
        state: 'available',
      })
      if (milestones.state === 'available') {
        expect(
          milestones.milestones.filter(
            (milestone) => milestone.state === 'reached',
          ),
        ).toHaveLength(reachedCount)
      }
    },
  )

  it('keeps overshot milestone celebrations unique and renders the available component state', () => {
    const participant = createParticipantFixture({
      id: 'participant-overshot',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const milestones = milestonesFor(participant, [
      weighIn(participant.id, currentSunday, 75),
    ])
    const flow = weeklyFlow([], [])
    const celebrations = createWeeklyCelebrations({
      eligibility: flow.eligibility,
      participantMilestones: [milestones, milestones],
      winners: flow.winners,
    })

    expect(celebrations.milestoneCelebrations).toEqual([
      {
        challengeId: challengeFixture.id,
        milestones: [25, 50, 75, 100].map((thresholdPercentage) => ({
          state: 'reached',
          thresholdPercentage,
        })),
        participantId: participant.id,
        state: 'available',
      },
    ])

    render(<MilestoneProgress milestones={milestones} />)
    expect(
      screen.getByRole('progressbar', {
        name: 'Milestone progress: 100% complete',
      }),
    ).toHaveAttribute('aria-valuenow', '100')
  })

  it('keeps no-target and no-records states safe through the component and celebration layer', () => {
    const noTarget = createParticipantFixture({
      id: 'participant-no-target',
      targetWeightKg: undefined,
    })
    const noRecords = createParticipantFixture({ id: 'participant-no-records' })
    const noTargetMilestones = milestonesFor(noTarget, [
      weighIn(noTarget.id, currentSunday, 90),
    ])
    const noRecordsMilestones = milestonesFor(noRecords, [])
    const flow = weeklyFlow([noTarget, noRecords], [])
    const celebrations = createWeeklyCelebrations({
      eligibility: flow.eligibility,
      participantMilestones: [noTargetMilestones, noRecordsMilestones],
      winners: flow.winners,
    })

    expect(celebrations).toMatchObject({
      milestoneCelebrations: [
        { reason: 'no-target', state: 'unavailable' },
        { reason: 'no-records', state: 'unavailable' },
      ],
      weeklyWin: { state: 'no-eligible-candidates' },
    })

    render(<MilestoneProgress milestones={noTargetMilestones} />)
    expect(screen.getByRole('status')).toHaveTextContent('Not available.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

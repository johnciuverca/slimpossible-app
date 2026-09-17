import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createParticipantDashboardFlow } from './participantDashboardFlow'
import type { ParticipantDashboardInput } from './participantDashboard'

function createInput(
  overrides: Partial<ParticipantDashboardInput> = {},
): ParticipantDashboardInput {
  const participant = createParticipantFixture()

  return {
    challenge: challengeFixture,
    participantId: participant.id,
    participants: [participant],
    weighIns: [],
    ...overrides,
  }
}

describe('createParticipantDashboardFlow', () => {
  it('composes every Chapter 7 section for a ready participant', () => {
    const participant = createParticipantFixture()
    const flow = createParticipantDashboardFlow(
      createInput({
        participants: [participant],
        weighIns: [
          { date: '2026-09-13', participantId: participant.id, weightKg: 92.5 },
          { date: '2026-09-15', participantId: participant.id, weightKg: 88 },
        ],
      }),
    )

    expect(flow.dashboard).toMatchObject({
      currentWeightKg: 88,
      state: 'ready',
      totalChangeKg: -4.5,
    })
    expect(flow.progressSummary).toMatchObject({
      completionPercentage: 36,
      state: 'in-progress',
    })
    expect(flow.historyTrend).toMatchObject({
      recordCount: 2,
      state: 'ready',
      trendDirection: 'loss',
    })
    expect(flow.featurePlaceholders).toMatchObject({
      recordCount: 2,
      streak: { state: 'rules-required', value: null },
      weeklyWin: { state: 'rules-required', value: null },
    })
  })

  it('preserves the no-records states across every dashboard section', () => {
    const flow = createParticipantDashboardFlow(createInput())

    expect(flow.dashboard).toMatchObject({ state: 'no-records' })
    expect(flow.progressSummary).toMatchObject({ state: 'first-record' })
    expect(flow.historyTrend).toMatchObject({
      recordCount: 0,
      state: 'no-records',
      trendDirection: null,
    })
    expect(flow.featurePlaceholders).toMatchObject({
      streak: { state: 'no-records', value: null },
      weeklyWin: { state: 'no-records', value: null },
    })
  })

  it('preserves no-target progress while keeping real history visible', () => {
    const participant = createParticipantFixture({ targetWeightKg: undefined })
    const flow = createParticipantDashboardFlow(
      createInput({
        participants: [participant],
        weighIns: [
          { date: '2026-09-15', participantId: participant.id, weightKg: 88 },
        ],
      }),
    )

    expect(flow.dashboard).toMatchObject({
      state: 'ready',
      targetWeightKg: null,
    })
    expect(flow.progressSummary).toMatchObject({
      message: 'Add a target weight to see your progress.',
      state: 'no-target',
    })
    expect(flow.historyTrend).toMatchObject({
      recordCount: 1,
      state: 'insufficient-history',
    })
    expect(flow.featurePlaceholders).toMatchObject({
      streak: { state: 'rules-required', value: null },
    })
  })

  it('keeps every section safe when the participant is not found', () => {
    const flow = createParticipantDashboardFlow(
      createInput({
        participantId: 'missing-participant',
        participants: [],
        weighIns: [
          {
            date: '2026-09-15',
            participantId: 'missing-participant',
            weightKg: 88,
          },
        ],
      }),
    )

    expect(flow.dashboard).toMatchObject({
      participant: null,
      state: 'participant-not-found',
    })
    expect(flow.progressSummary).toMatchObject({
      state: 'participant-not-found',
    })
    expect(flow.historyTrend).toMatchObject({
      history: [],
      recordCount: 0,
      state: 'no-records',
    })
    expect(flow.featurePlaceholders).toMatchObject({
      latestRecordDate: null,
      streak: { state: 'no-records' },
    })
  })
})

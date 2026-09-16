import { describe, expect, it } from 'vitest'

import { challengeFixture, createParticipantFixture } from './fixtures'
import { createGroupDashboardFlow } from './groupDashboardFlow'

describe('createGroupDashboardFlow', () => {
  it('composes the safe Chapter 8 group sections for a ready group', () => {
    const firstParticipant = createParticipantFixture({
      displayName: 'Ava Active',
      id: 'participant-ava',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })
    const secondParticipant = createParticipantFixture({
      displayName: 'Ben Active',
      id: 'participant-ben',
      startingWeightKg: 100,
      targetWeightKg: 80,
    })

    const flow = createGroupDashboardFlow({
      challenge: challengeFixture,
      participants: [firstParticipant, secondParticipant],
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
      ],
    })

    expect(flow.aggregation).toMatchObject({
      activeParticipantCount: 2,
      averageCompletionPercentage: 75,
      state: 'ready',
    })
    expect(flow.display).toMatchObject({
      participantCards: [
        { displayName: 'Ava Active', state: 'in-progress' },
        { displayName: 'Ben Active', state: 'target-reached' },
      ],
      progressSummary: { state: 'ready' },
    })
    expect(flow.leaderboard).toEqual({
      entries: [],
      message:
        'Leaderboard rankings are unavailable until comparison rules are defined.',
      state: 'rules-required',
      statusLabel: 'Leaderboard coming soon',
    })
  })

  it('preserves a no-records group without creating progress or leaderboard claims', () => {
    const participant = createParticipantFixture({
      displayName: 'Ava Active',
      id: 'participant-ava',
    })
    const flow = createGroupDashboardFlow({
      challenge: challengeFixture,
      participants: [participant],
      weighIns: [],
    })

    expect(flow.aggregation).toMatchObject({
      averageCompletionPercentage: null,
      state: 'no-records',
    })
    expect(flow.display).toMatchObject({
      participantCards: [
        { state: 'first-record', statusLabel: 'First weigh-in needed' },
      ],
      progressSummary: { state: 'no-records' },
    })
    expect(flow.leaderboard.entries).toEqual([])
  })

  it('preserves unavailable target completion while keeping the leaderboard empty', () => {
    const participant = createParticipantFixture({
      id: 'participant-no-target',
      targetWeightKg: undefined,
    })
    const flow = createGroupDashboardFlow({
      challenge: challengeFixture,
      participants: [participant],
      weighIns: [
        { date: '2026-09-15', participantId: participant.id, weightKg: 90 },
      ],
    })

    expect(flow.aggregation).toMatchObject({
      completionState: 'unavailable',
      state: 'ready',
    })
    expect(flow.display.progressSummary).toMatchObject({
      state: 'completion-unavailable',
    })
    expect(flow.display.participantCards).toMatchObject([
      { state: 'no-target', statusLabel: 'No target set' },
    ])
    expect(flow.leaderboard.entries).toEqual([])
  })
})

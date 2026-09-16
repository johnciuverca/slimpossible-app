import { describe, expect, it } from 'vitest'

import { createPrivacyAwareGroupDisplay } from './privacyAwareGroupDisplay'
import type { ActiveParticipantCard } from './activeParticipantCards'
import type { GroupProgressSummary } from './groupProgressSummary'

const readySummary: GroupProgressSummary = {
  activeParticipantCount: 2,
  averageCompletionPercentage: 50,
  message: 'Progress is available for 2 of 2 active participants.',
  participantsWithProgressCount: 2,
  participantsWithRecordedWeightCount: 2,
  reachedTargetCount: 1,
  state: 'ready',
  statusLabel: 'Group progress available',
}

const readyCard: ActiveParticipantCard = {
  completionPercentage: 50,
  displayName: 'Ava Active',
  message: 'You are 10 kg away from your target weight.',
  participantId: 'participant-ava',
  state: 'in-progress',
  statusLabel: 'In progress',
}

describe('createPrivacyAwareGroupDisplay', () => {
  it('composes the approved ready summary and cards without ranking them', () => {
    expect(
      createPrivacyAwareGroupDisplay({
        participantCards: [readyCard],
        progressSummary: readySummary,
      }),
    ).toEqual({
      participantCards: [readyCard],
      progressSummary: readySummary,
    })
  })

  it('preserves an unavailable summary and its explicit empty card list', () => {
    expect(
      createPrivacyAwareGroupDisplay({
        participantCards: [],
        progressSummary: {
          ...readySummary,
          activeParticipantCount: 0,
          averageCompletionPercentage: null,
          message: 'There are no active participants in this challenge yet.',
          participantsWithProgressCount: 0,
          participantsWithRecordedWeightCount: 0,
          reachedTargetCount: 0,
          state: 'empty',
          statusLabel: 'No active participants',
        },
      }),
    ).toMatchObject({
      participantCards: [],
      progressSummary: {
        averageCompletionPercentage: null,
        state: 'empty',
        statusLabel: 'No active participants',
      },
    })
  })

  it('removes private and unsupported runtime fields from cards and summaries', () => {
    const unsafeCard = {
      ...readyCard,
      currentWeightKg: 88,
      note: 'Private note',
      rank: 1,
      streak: 5,
      targetWeightKg: 80,
      weeklyWin: true,
      weighInHistory: [{ date: '2026-09-15', weightKg: 88 }],
    } as ActiveParticipantCard
    const unsafeSummary = {
      ...readySummary,
      participantNames: ['Ava Active'],
      rawWeights: [88],
      rankings: ['Ava Active'],
    } as GroupProgressSummary

    const display = createPrivacyAwareGroupDisplay({
      participantCards: [unsafeCard],
      progressSummary: unsafeSummary,
    })
    const serialized = JSON.stringify(display)

    expect(display.participantCards[0]).not.toHaveProperty('currentWeightKg')
    expect(display.participantCards[0]).not.toHaveProperty('targetWeightKg')
    expect(display.participantCards[0]).not.toHaveProperty('note')
    expect(display.progressSummary).not.toHaveProperty('participantNames')
    expect(display.progressSummary).not.toHaveProperty('rawWeights')
    expect(display.progressSummary).not.toHaveProperty('rankings')
    expect(serialized).not.toContain('Private note')
    expect(serialized).not.toContain('weighInHistory')
    expect(serialized).not.toContain('weeklyWin')
    expect(serialized).not.toContain('streak')
    expect(serialized).not.toContain('rank')
    expect(serialized).not.toContain('88')
  })
})

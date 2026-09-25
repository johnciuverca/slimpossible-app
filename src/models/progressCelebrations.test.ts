import { describe, expect, it } from 'vitest'

import type { ParticipantMilestones } from './participantMilestones'
import {
  reconcileMilestoneCelebration,
  reconcileWeeklyWinCelebration,
  type CelebrationStorage,
} from './progressCelebrations'
import type { GroupProgressSummary } from './groupProgress'
import { createSavedWeeklyWinCelebration } from './weeklyCelebrations'

class MemoryStorage implements CelebrationStorage {
  values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function milestones(reached: readonly number[]): ParticipantMilestones {
  const completionPercentage = Math.max(0, ...reached)
  return {
    challengeId: 'challenge-1',
    completionPercentage,
    milestones: [25, 50, 75, 100].map((thresholdPercentage) => ({
      id: `challenge-1:participant-1:${thresholdPercentage}`,
      state: reached.includes(thresholdPercentage as 25 | 50 | 75 | 100)
        ? 'reached'
        : 'upcoming',
      thresholdPercentage: thresholdPercentage as 25 | 50 | 75 | 100,
    })),
    participantId: 'participant-1',
    state: 'available',
  }
}

function groupSummary(
  overrides: Partial<GroupProgressSummary> = {},
): GroupProgressSummary {
  return {
    activeParticipantCount: 3,
    averageCompletionPercentage: 50,
    challengeId: 'challenge-1',
    currentSunday: '2026-09-20',
    eligibleParticipantCount: 0,
    participantsWithProgressCount: 3,
    participantsWithRecordedWeightCount: 3,
    previousSunday: '2026-09-13',
    reachedTargetCount: 1,
    weeklyWinnerCount: 0,
    weeklyWinnerNames: [],
    ...overrides,
  }
}

describe('reconcileMilestoneCelebration', () => {
  it('initializes silently, then announces newly reached milestones only once', () => {
    const storage = new MemoryStorage()

    expect(
      reconcileMilestoneCelebration('user-1', milestones([]), storage),
    ).toBe('')
    expect(
      reconcileMilestoneCelebration('user-1', milestones([25, 50]), storage),
    ).toBe('Milestone reached: 25%, 50% of your goal.')
    expect(
      reconcileMilestoneCelebration('user-1', milestones([25, 50]), storage),
    ).toBe('')
  })

  it('retracts a corrected milestone and can celebrate it if later reached again', () => {
    const storage = new MemoryStorage()
    reconcileMilestoneCelebration('user-1', milestones([25, 50]), storage)

    expect(
      reconcileMilestoneCelebration('user-1', milestones([25]), storage),
    ).toBe('Saved progress changed; the 50% milestone is no longer reached.')
    expect(
      reconcileMilestoneCelebration('user-1', milestones([25]), storage),
    ).toBe('')
    expect(
      reconcileMilestoneCelebration('user-1', milestones([25, 50]), storage),
    ).toBe('Milestone reached: 50% of your goal.')
  })

  it('does not store weigh-in values or announce if storage is unavailable', () => {
    const storage = new MemoryStorage()
    reconcileMilestoneCelebration('user-1', milestones([]), storage)
    reconcileMilestoneCelebration('user-1', milestones([25]), storage)

    expect([...storage.values.values()].join(' ')).not.toMatch(/\d{2,3}\.\d/)
    expect(
      reconcileMilestoneCelebration('user-1', milestones([50]), {
        getItem() {
          throw new Error('Storage disabled')
        },
        setItem() {
          throw new Error('Storage disabled')
        },
      }),
    ).toBe('')
  })
})

describe('createSavedWeeklyWinCelebration and reconcileWeeklyWinCelebration', () => {
  it('announces a saved result once and updates it after late or corrected entries', () => {
    const storage = new MemoryStorage()
    const unavailable = createSavedWeeklyWinCelebration(groupSummary())
    const firstResult = createSavedWeeklyWinCelebration(
      groupSummary({
        eligibleParticipantCount: 2,
        weeklyWinnerCount: 1,
        weeklyWinnerNames: ['Ava'],
      }),
    )

    expect(reconcileWeeklyWinCelebration('user-1', unavailable, storage)).toBe(
      '',
    )
    expect(reconcileWeeklyWinCelebration('user-1', firstResult, storage)).toBe(
      'Weekly result posted: Ava.',
    )
    expect(reconcileWeeklyWinCelebration('user-1', firstResult, storage)).toBe(
      '',
    )

    const correctedResult = createSavedWeeklyWinCelebration(
      groupSummary({
        eligibleParticipantCount: 3,
        weeklyWinnerCount: 2,
        weeklyWinnerNames: ['Ben', 'Casey'],
      }),
    )
    expect(
      reconcileWeeklyWinCelebration('user-1', correctedResult, storage),
    ).toBe('Weekly result updated: Ben, Casey.')
    expect(
      reconcileWeeklyWinCelebration('user-1', correctedResult, storage),
    ).toBe('')
  })

  it('withdraws a result when corrected saved records leave no eligible winner', () => {
    const storage = new MemoryStorage()
    const winner = createSavedWeeklyWinCelebration(
      groupSummary({
        eligibleParticipantCount: 1,
        weeklyWinnerCount: 1,
        weeklyWinnerNames: ['Ava'],
      }),
    )
    const noResult = createSavedWeeklyWinCelebration(groupSummary())
    reconcileWeeklyWinCelebration('user-1', winner, storage)

    expect(reconcileWeeklyWinCelebration('user-1', noResult, storage)).toBe(
      'Weekly result updated. No winner is currently eligible for these Sundays.',
    )
    expect(reconcileWeeklyWinCelebration('user-1', noResult, storage)).toBe('')
  })

  it('persists only a result signature, not names or private weigh-in values', () => {
    const storage = new MemoryStorage()
    const result = createSavedWeeklyWinCelebration(
      groupSummary({
        eligibleParticipantCount: 2,
        weeklyWinnerCount: 1,
        weeklyWinnerNames: ['Ava'],
      }),
    )
    reconcileWeeklyWinCelebration('user-1', result, storage)

    const stored = [...storage.values.entries()].map(
      ([key, value]) => key + value,
    )
    expect(stored.join(' ')).not.toContain('Ava')
    expect(stored.join(' ')).not.toMatch(/\d{2,3}\.\d/)
  })
})

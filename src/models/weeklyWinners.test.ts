import { describe, expect, it } from 'vitest'

import { determineWeeklyProgressEligibility } from './weeklyProgressEligibility'
import { determineWeeklyWinners } from './weeklyWinners'
import type { WeeklyProgressEligibility } from './weeklyProgressEligibility'

function eligibility(
  candidates: WeeklyProgressEligibility['candidates'],
): WeeklyProgressEligibility {
  return {
    activeParticipantCount: candidates.length,
    candidates,
    currentSunday: '2026-09-20',
    previousSunday: '2026-09-13',
    state:
      candidates.length > 0
        ? 'eligible-candidates'
        : 'no-eligible-participants',
  }
}

describe('determineWeeklyWinners', () => {
  it('returns no winners when 9.1 has no eligible candidates', () => {
    expect(determineWeeklyWinners(eligibility([]))).toEqual({
      bestWeeklyChangeKg: null,
      state: 'no-winners',
      winners: [],
    })
  })

  it('selects the largest loss as the single weekly winner', () => {
    expect(
      determineWeeklyWinners(
        eligibility([
          { participantId: 'participant-ava', weeklyWeightChangeKg: -1 },
          { participantId: 'participant-ben', weeklyWeightChangeKg: -3 },
          { participantId: 'participant-casey', weeklyWeightChangeKg: -2 },
        ]),
      ),
    ).toEqual({
      bestWeeklyChangeKg: -3,
      state: 'winner',
      winners: [{ participantId: 'participant-ben' }],
    })
  })

  it('selects maintaining weight over any gain', () => {
    expect(
      determineWeeklyWinners(
        eligibility([
          { participantId: 'participant-maintain', weeklyWeightChangeKg: 0 },
          { participantId: 'participant-gain', weeklyWeightChangeKg: 2 },
        ]),
      ),
    ).toEqual({
      bestWeeklyChangeKg: 0,
      state: 'winner',
      winners: [{ participantId: 'participant-maintain' }],
    })
  })

  it('selects the smallest gain when every eligible participant gained', () => {
    expect(
      determineWeeklyWinners(
        eligibility([
          { participantId: 'participant-ava', weeklyWeightChangeKg: 3 },
          { participantId: 'participant-ben', weeklyWeightChangeKg: 1 },
          { participantId: 'participant-casey', weeklyWeightChangeKg: 2 },
        ]),
      ),
    ).toEqual({
      bestWeeklyChangeKg: 1,
      state: 'winner',
      winners: [{ participantId: 'participant-ben' }],
    })
  })

  it('returns shared winners for equal best changes', () => {
    expect(
      determineWeeklyWinners(
        eligibility([
          { participantId: 'participant-ava', weeklyWeightChangeKg: -2 },
          { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
          { participantId: 'participant-casey', weeklyWeightChangeKg: 0 },
        ]),
      ),
    ).toEqual({
      bestWeeklyChangeKg: -2,
      state: 'shared-winners',
      winners: [
        { participantId: 'participant-ava' },
        { participantId: 'participant-ben' },
      ],
    })
  })

  it('recalculates winners whenever the 9.1 candidates change', () => {
    const beforeLateEdit = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -4 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
    ])
    const afterLateEdit = eligibility([
      { participantId: 'participant-ava', weeklyWeightChangeKg: -1 },
      { participantId: 'participant-ben', weeklyWeightChangeKg: -2 },
    ])

    expect(determineWeeklyWinners(beforeLateEdit)).toMatchObject({
      winners: [{ participantId: 'participant-ava' }],
    })
    expect(determineWeeklyWinners(afterLateEdit)).toMatchObject({
      winners: [{ participantId: 'participant-ben' }],
    })
  })

  it('keeps non-group eligibility results without winners', () => {
    const nonGroupEligibility = determineWeeklyProgressEligibility({
      challengeId: 'challenge-1',
      challengeScope: 'individual',
      currentSunday: '2026-09-20',
      participants: [],
      previousSunday: '2026-09-13',
      weighIns: [],
    })

    expect(determineWeeklyWinners(nonGroupEligibility)).toMatchObject({
      bestWeeklyChangeKg: null,
      state: 'no-winners',
      winners: [],
    })
  })

  it('does not expose candidate changes, raw weights, notes, or rankings', () => {
    const unsafeEligibility = eligibility([
      {
        participantId: 'participant-ava',
        weeklyWeightChangeKg: -2,
      },
    ]) as WeeklyProgressEligibility & {
      candidates: Array<{
        note: string
        participantId: string
        rank: number
        weeklyWeightChangeKg: number
        weightKg: number
      }>
    }
    unsafeEligibility.candidates[0] = {
      ...unsafeEligibility.candidates[0],
      note: 'Private note',
      rank: 1,
      weightKg: 95,
    }

    const result = determineWeeklyWinners(unsafeEligibility)
    const serialized = JSON.stringify(result)

    expect(result.winners[0]).not.toHaveProperty('weeklyWeightChangeKg')
    expect(result.winners[0]).not.toHaveProperty('weightKg')
    expect(result.winners[0]).not.toHaveProperty('note')
    expect(serialized).not.toContain('Private note')
    expect(serialized).not.toContain('rank')
    expect(serialized).not.toContain('95')
  })
})

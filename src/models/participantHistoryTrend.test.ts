import { describe, expect, it } from 'vitest'

import { createParticipantHistoryTrend } from './participantHistoryTrend'
import type { WeighIn } from './weighIn'

const participantId = 'participant-1'

function weighIn(date: string, weightKg: number): WeighIn {
  return { date, participantId, weightKg }
}

describe('createParticipantHistoryTrend', () => {
  it('filters to the participant, orders actual records newest first, and shows loss', () => {
    const history = createParticipantHistoryTrend(
      [
        weighIn('2026-09-13', 100),
        {
          date: '2026-09-16',
          participantId: 'another-participant',
          weightKg: 70,
        },
        weighIn('2026-09-15', 95),
      ],
      participantId,
    )

    expect(history).toMatchObject({
      history: [
        { date: '2026-09-15', weightKg: 95 },
        { date: '2026-09-13', weightKg: 100 },
      ],
      latestWeighIn: { date: '2026-09-15', weightKg: 95 },
      recordCount: 2,
      state: 'ready',
      trendChangeKg: -5,
      trendDirection: 'loss',
    })
  })

  it('shows gain from the first actual record to the latest actual record', () => {
    expect(
      createParticipantHistoryTrend(
        [weighIn('2026-09-13', 70), weighIn('2026-09-15', 75)],
        participantId,
      ),
    ).toMatchObject({
      state: 'ready',
      trendChangeKg: 5,
      trendDirection: 'gain',
    })
  })

  it('shows unchanged when distinct recorded values are stable', () => {
    expect(
      createParticipantHistoryTrend(
        [weighIn('2026-09-13', 80), weighIn('2026-09-15', 80)],
        participantId,
      ),
    ).toMatchObject({
      state: 'ready',
      trendChangeKg: 0,
      trendDirection: 'unchanged',
    })
  })

  it('does not fabricate history or a trend when no records exist', () => {
    expect(createParticipantHistoryTrend([], participantId)).toEqual({
      history: [],
      latestWeighIn: null,
      recordCount: 0,
      state: 'no-records',
      trendChangeKg: null,
      trendDirection: null,
    })
  })

  it('does not claim a trend from one recorded weigh-in', () => {
    expect(
      createParticipantHistoryTrend([weighIn('2026-09-15', 80)], participantId),
    ).toMatchObject({
      history: [{ date: '2026-09-15', weightKg: 80 }],
      latestWeighIn: { date: '2026-09-15', weightKg: 80 },
      recordCount: 1,
      state: 'insufficient-history',
      trendChangeKg: null,
      trendDirection: null,
    })
  })

  it('keeps missing calendar days absent from the participant history', () => {
    const history = createParticipantHistoryTrend(
      [weighIn('2026-09-13', 100), weighIn('2026-09-15', 95)],
      participantId,
    )

    expect(history.history.map(({ date }) => date)).toEqual([
      '2026-09-15',
      '2026-09-13',
    ])
    expect(history.history.some(({ date }) => date === '2026-09-14')).toBe(
      false,
    )
  })
})

import { describe, expect, it } from 'vitest'

import { createParticipantFeaturePlaceholders } from './participantFeaturePlaceholders'
import { createParticipantHistoryTrend } from './participantHistoryTrend'
import type { WeighIn } from './weighIn'

const participantId = 'participant-1'

function weighIn(date: string, weightKg: number): WeighIn {
  return { date, participantId, weightKg }
}

describe('createParticipantFeaturePlaceholders', () => {
  it('keeps streaks and weekly wins unavailable when no records exist', () => {
    expect(
      createParticipantFeaturePlaceholders(
        createParticipantHistoryTrend([], participantId),
      ),
    ).toEqual({
      latestRecordDate: null,
      recordCount: 0,
      streak: {
        message: 'Record a weigh-in before future streak tracking can begin.',
        state: 'no-records',
        value: null,
      },
      weeklyWin: {
        message: 'Record a weigh-in before weekly wins can be assessed.',
        state: 'no-records',
        value: null,
      },
    })
  })

  it('grounds placeholder copy in real records without inventing a streak or win', () => {
    expect(
      createParticipantFeaturePlaceholders(
        createParticipantHistoryTrend(
          [weighIn('2026-09-13', 100), weighIn('2026-09-15', 95)],
          participantId,
        ),
      ),
    ).toEqual({
      latestRecordDate: '2026-09-15',
      recordCount: 2,
      streak: {
        message:
          '2 recorded weigh-ins are available, but a streak needs an explicit calendar continuity rule.',
        state: 'rules-required',
        value: null,
      },
      weeklyWin: {
        message:
          '2 recorded weigh-ins are available, but weekly wins require defined winning criteria.',
        state: 'rules-required',
        value: null,
      },
    })
  })

  it('keeps a one-record history explicitly unknown rather than treating it as a streak', () => {
    const placeholders = createParticipantFeaturePlaceholders(
      createParticipantHistoryTrend([weighIn('2026-09-15', 95)], participantId),
    )

    expect(placeholders).toMatchObject({
      latestRecordDate: '2026-09-15',
      recordCount: 1,
      streak: {
        message:
          '1 recorded weigh-in is available, but a streak needs an explicit calendar continuity rule.',
        state: 'rules-required',
        value: null,
      },
      weeklyWin: {
        state: 'rules-required',
        value: null,
      },
    })
  })
})

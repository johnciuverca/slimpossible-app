import { describe, expect, it } from 'vitest'
import { personalHistory } from './personalHistory'

describe('personal history', () => {
  it('sorts real entries without mutating input, ignores future records, and uses an inclusive window', () => {
    const entries = [
      { id: 'old', date: '2026-09-08', weightKg: 90, sharedChallengeIds: [] },
      { id: 'new', date: '2026-10-08', weightKg: 88, sharedChallengeIds: [] },
      {
        id: 'future',
        date: '2026-10-09',
        weightKg: 70,
        sharedChallengeIds: [],
      },
      {
        id: 'boundary',
        date: '2026-09-09',
        weightKg: 91,
        sharedChallengeIds: [],
      },
    ]
    const recent = personalHistory(entries, '2026-10-08', 30)
    expect(recent.history.map(({ id }) => id)).toEqual(['new', 'boundary'])
    expect(recent.changeKg).toBe(-3)
    expect(
      personalHistory(entries, '2026-10-08').history.map(({ id }) => id),
    ).toEqual(['new', 'boundary', 'old'])
    expect(entries[0].id).toBe('old')
  })
  it('does not invent a trend for empty or single-entry histories', () => {
    expect(personalHistory([], '2026-10-08')).toEqual({
      history: [],
      latest: null,
      changeKg: null,
    })
    expect(
      personalHistory(
        [
          {
            id: 'one',
            date: '2026-10-08',
            weightKg: 80,
            sharedChallengeIds: [],
          },
        ],
        '2026-10-08',
      ).changeKg,
    ).toBeNull()
  })
})

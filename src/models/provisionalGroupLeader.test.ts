import { describe, expect, it } from 'vitest'

import { localDateOnly, provisionalWeekDates } from './provisionalGroupLeader'

describe('provisionalWeekDates', () => {
  it.each([
    [
      '2026-09-14',
      {
        currentWeekEnd: '2026-09-20',
        currentWeekStart: '2026-09-14',
        previousSunday: '2026-09-13',
      },
    ],
    [
      '2026-09-20',
      {
        currentWeekEnd: '2026-09-20',
        currentWeekStart: '2026-09-14',
        previousSunday: '2026-09-13',
      },
    ],
    [
      '2026-09-21',
      {
        currentWeekEnd: '2026-09-27',
        currentWeekStart: '2026-09-21',
        previousSunday: '2026-09-20',
      },
    ],
  ])('uses the exact Monday-Sunday window for %s', (currentDate, expected) => {
    expect(provisionalWeekDates(currentDate)).toEqual(expected)
  })

  it('rejects invalid date-only inputs', () => {
    expect(() => provisionalWeekDates('2026-02-30')).toThrow(
      'Current date must be a valid YYYY-MM-DD date.',
    )
  })
})

describe('localDateOnly', () => {
  it.each([
    ['Europe/Bucharest', '2026-09-20'],
    ['America/Los_Angeles', '2026-09-19'],
  ])('uses the local calendar date in %s', (timezone, expected) => {
    const originalTimezone = process.env.TZ
    process.env.TZ = timezone

    try {
      expect(localDateOnly(new Date('2026-09-19T21:30:00.000Z'))).toBe(expected)
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })
})

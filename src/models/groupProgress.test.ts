import { describe, expect, it } from 'vitest'

import { mostRecentSunday } from './groupProgress'

describe('mostRecentSunday', () => {
  it.each([
    ['Europe/Bucharest', '2026-09-20'],
    ['America/Los_Angeles', '2026-09-13'],
  ])('uses the local calendar Sunday in %s', (timezone, expectedSunday) => {
    const originalTimezone = process.env.TZ
    process.env.TZ = timezone

    try {
      expect(mostRecentSunday(new Date('2026-09-19T21:30:00.000Z'))).toBe(
        expectedSunday,
      )
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })

  it('returns YYYY-MM-DD without UTC conversion rollover', () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'Europe/Bucharest'

    try {
      expect(mostRecentSunday(new Date('2026-09-20T23:59:00.000Z'))).toBe(
        '2026-09-20',
      )
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })
})

import { describe, expect, it } from 'vitest'

import { mostRecentSunday } from './groupProgress'

describe('mostRecentSunday', () => {
  it('uses the current day when it is Sunday', () => {
    expect(mostRecentSunday(new Date('2026-09-20T23:59:00.000Z'))).toBe(
      '2026-09-20',
    )
  })

  it('moves back to the latest Sunday and normalizes across UTC dates', () => {
    expect(mostRecentSunday(new Date('2026-09-24T00:15:00.000Z'))).toBe(
      '2026-09-20',
    )
    expect(mostRecentSunday(new Date('2026-09-19T23:30:00.000Z'))).toBe(
      '2026-09-13',
    )
  })
})

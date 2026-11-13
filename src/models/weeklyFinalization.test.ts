import { describe, expect, it } from 'vitest'
import {
  mostRecentWeeklySunday,
  weeklyProvisionalCutoff,
} from './weeklyFinalization'

describe('weekly Sunday cutoff', () => {
  it('uses 20:00 Europe/Bucharest through standard and daylight time', () => {
    expect(weeklyProvisionalCutoff('2026-01-11').toISOString()).toBe(
      '2026-01-11T18:00:00.000Z',
    )
    expect(weeklyProvisionalCutoff('2026-07-12').toISOString()).toBe(
      '2026-07-12T17:00:00.000Z',
    )
  })

  it('selects the current Sunday using Bucharest midnight across DST', () => {
    expect(mostRecentWeeklySunday(new Date('2026-10-24T20:59:00.000Z'))).toBe(
      '2026-10-18',
    )
    expect(mostRecentWeeklySunday(new Date('2026-10-24T21:00:00.000Z'))).toBe(
      '2026-10-25',
    )
  })
})

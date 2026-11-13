import { describe, expect, it } from 'vitest'
import {
  eligibleSundayValue,
  mostRecentWeeklySunday,
  weeklyFinalCutoff,
  weeklyProvisionalCutoff,
  type MembershipEpisode,
  type WeeklyEndpoint,
} from './weeklyFinalization'

const membership: MembershipEpisode = {
  joinedAt: '2026-01-01T00:00:00.000Z',
  withdrawnAt: null,
}

function endpoint(
  sunday: string,
  weightKg: number,
  committedAt: string,
  shared = true,
): WeeklyEndpoint {
  return { sunday, weightKg, committedAt, shared }
}

describe('weekly result cutoffs and Sunday values', () => {
  it('uses Bucharest wall time across standard and daylight time', () => {
    expect(weeklyProvisionalCutoff('2026-01-11').toISOString()).toBe(
      '2026-01-11T18:00:00.000Z',
    )
    expect(weeklyFinalCutoff('2026-07-12').toISOString()).toBe(
      '2026-07-13T17:00:00.000Z',
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

  it('treats a commit exactly at cutoff as ineligible', () => {
    const cutoff = weeklyFinalCutoff('2026-01-11')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership,
        endpoints: [endpoint('2026-01-11', 70, cutoff.toISOString())],
      }),
    ).toBeNull()
  })

  it('prefers the actual Sunday value over a possible interpolation', () => {
    const cutoff = weeklyFinalCutoff('2026-01-11')
    const values = [
      endpoint('2026-01-04', 80, '2026-01-04T10:00:00Z'),
      endpoint('2026-01-11', 78.2, '2026-01-11T10:00:00Z'),
      endpoint('2026-01-18', 76, '2026-01-18T10:00:00Z'),
    ]
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership,
        endpoints: values,
      }),
    ).toEqual({ estimated: false, sunday: '2026-01-11', weightKg: 78.2 })
  })

  it('interpolates only from eligible shared actual endpoints and rounds to 0.05kg', () => {
    const cutoff = weeklyFinalCutoff('2026-01-18')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership,
        endpoints: [
          endpoint('2026-01-04', 80, '2026-01-04T10:00:00Z'),
          endpoint('2026-01-18', 77.93, '2026-01-18T10:00:00Z'),
          endpoint('2026-01-25', 70, '2026-01-25T10:00:00Z', false),
        ],
      }),
    ).toEqual({ estimated: true, sunday: '2026-01-11', weightKg: 78.95 })
  })

  it('does not extrapolate or use pre-join endpoints', () => {
    const cutoff = weeklyFinalCutoff('2026-01-18')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership: { joinedAt: '2026-01-12T00:00:00Z', withdrawnAt: null },
        endpoints: [
          endpoint('2026-01-04', 80, '2026-01-04T10:00:00Z'),
          endpoint('2026-01-18', 77, '2026-01-18T10:00:00Z'),
        ],
      }),
    ).toBeNull()
  })

  it('uses Bucharest calendar dates to exclude a pre-join recorded Sunday', () => {
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: weeklyFinalCutoff('2026-01-11'),
        membership: {
          joinedAt: '2026-01-11T22:30:00Z',
          withdrawnAt: null,
        },
        endpoints: [endpoint('2026-01-11', 80, '2026-01-12T10:00:00Z')],
      }),
    ).toBeNull()
  })

  it('uses only evidence committed before the final cutoff', () => {
    const cutoff = weeklyFinalCutoff('2026-01-18')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership,
        endpoints: [
          endpoint('2026-01-04', 80, '2026-01-04T10:00:00Z'),
          endpoint('2026-01-18', 77, cutoff.toISOString()),
        ],
      }),
    ).toBeNull()
  })

  it('keeps the last pre-cutoff actual after a late correction', () => {
    const cutoff = weeklyFinalCutoff('2026-01-11')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership,
        endpoints: [
          endpoint('2026-01-11', 78, '2026-01-11T12:00:00Z'),
          endpoint('2026-01-11', 74, cutoff.toISOString()),
        ],
      }),
    ).toEqual({ estimated: false, sunday: '2026-01-11', weightKg: 78 })
  })

  it('excludes a membership withdrawn by the final cutoff', () => {
    const cutoff = weeklyFinalCutoff('2026-01-11')
    expect(
      eligibleSundayValue({
        sunday: '2026-01-11',
        finalCutoff: cutoff,
        membership: { ...membership, withdrawnAt: cutoff.toISOString() },
        endpoints: [endpoint('2026-01-11', 78, '2026-01-11T12:00:00Z')],
      }),
    ).toBeNull()
  })
})

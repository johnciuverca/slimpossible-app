import { describe, expect, it } from 'vitest'
import { interpolateMissingWeights } from './estimatedWeighIns'

describe('interpolateMissingWeights', () => {
  it('fills each missing calendar date with linearly interpolated values', () => {
    expect(
      interpolateMissingWeights([
        { date: '2026-11-05', weightKg: 89 },
        { date: '2026-11-01', weightKg: 90 },
      ]),
    ).toEqual([
      { date: '2026-11-02', weightKg: 89.75 },
      { date: '2026-11-03', weightKg: 89.5 },
      { date: '2026-11-04', weightKg: 89.25 },
    ])
  })

  it('rounds nonterminating estimates to the nearest 0.05 kg without tails', () => {
    expect(
      interpolateMissingWeights([
        { date: '2026-01-01', weightKg: 90 },
        { date: '2026-01-07', weightKg: 89 },
      ]),
    ).toEqual([
      { date: '2026-01-02', weightKg: 89.85 },
      { date: '2026-01-03', weightKg: 89.65 },
      { date: '2026-01-04', weightKg: 89.5 },
      { date: '2026-01-05', weightKg: 89.35 },
      { date: '2026-01-06', weightKg: 89.15 },
    ])
  })

  it.each([
    [89.54, 90, 89.75],
    [89.56, 90, 89.8],
  ])(
    'rounds the midpoint between %s kg and %s kg to the nearest 0.05 kg',
    (start, end, expected) => {
      expect(
        interpolateMissingWeights([
          { date: '2026-01-01', weightKg: start },
          { date: '2026-01-03', weightKg: end },
        ]),
      ).toEqual([{ date: '2026-01-02', weightKg: expected }])
    },
  )

  it.each([2, 3, 10, 15])('fills a gap of %i days without endpoints', (gap) => {
    const expectedCount = gap - 1
    const estimates = interpolateMissingWeights([
      { date: '2026-01-01', weightKg: 80 },
      {
        date: new Date(Date.UTC(2026, 0, gap + 1)).toISOString().slice(0, 10),
        weightKg: 80,
      },
    ])
    expect(estimates).toHaveLength(expectedCount)
    expect(estimates[0].date).toBe('2026-01-02')
    expect(estimates.at(-1)?.date).not.toBe('2026-01-01')
  })

  it('returns no values for one point or consecutive equal values', () => {
    expect(
      interpolateMissingWeights([{ date: '2026-01-01', weightKg: 80 }]),
    ).toEqual([])
    expect(
      interpolateMissingWeights([
        { date: '2026-01-01', weightKg: 80 },
        { date: '2026-01-02', weightKg: 80 },
      ]),
    ).toEqual([])
  })

  it('uses date-only UTC calendar arithmetic across daylight saving transitions', () => {
    expect(
      interpolateMissingWeights([
        { date: '2026-03-28', weightKg: 80 },
        { date: '2026-03-31', weightKg: 77 },
      ]),
    ).toEqual([
      { date: '2026-03-29', weightKg: 79 },
      { date: '2026-03-30', weightKg: 78 },
    ])
  })
})

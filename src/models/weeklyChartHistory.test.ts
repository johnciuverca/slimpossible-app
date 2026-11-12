import { expect, it } from 'vitest'
import { compactWeeklyHistory } from './weeklyChartHistory'
import type { SharedChartSeries } from '../components/SharedWeightChart'

const series = (
  dates: [string, number, boolean?][],
  id = 'owner',
): SharedChartSeries => ({
  id,
  color: 'green',
  points: dates.map(([date, value, estimated]) => ({
    date,
    value,
    estimated,
    title: date,
  })),
})

it('uses a common inclusive seven-day cutoff and excludes estimated weights', () => {
  const input = [
    series([
      ['2026-11-01', 80],
      ['2026-11-02', 82],
      ['2026-11-03', 200, true],
      ['2026-11-04', 84],
    ]),
    series([['2026-11-10', 70]], 'member'),
  ]
  const result = compactWeeklyHistory(input, new Set())
  expect(result[0].points.map((point) => point.value)).toEqual([80, 82, 84])
  expect(result[0].points[1].weeklySummary).toBe('owner:2026-11-02')
  expect(result[0].points[2].weeklySummary).toBeUndefined()
  expect(result[0].points[1].tooltip).toBe('02.11.2026 – 03.11.2026')
  expect(result[0].points[1].markerLabel).toContain('Weekly average 82 kg')
  expect(input[0].points).toHaveLength(4)
})

it('averages sparse actual records without filling empty weeks and restores original points', () => {
  const input = [
    series([
      ['2025-12-29', 80],
      ['2026-01-01', 82],
      ['2026-01-02', 900, true],
      ['2026-02-01', 75],
    ]),
  ]
  const result = compactWeeklyHistory(input, new Set())
  expect(result[0].points).toHaveLength(2)
  expect(result[0].points[0].value).toBe(81)
  expect(result[0].points[0].tooltip).toBe('29.12.2025 – 04.01.2026')
  expect(result[0].points[0].markerLabel).toContain('2 recorded weigh-ins')
  const expanded = compactWeeklyHistory(input, new Set(['owner:2025-12-29']))
  expect(expanded[0].points).toEqual(input[0].points)
})

it('uses UTC calendar math across DST and never produces an estimated-only summary', () => {
  const input = [
    series([
      ['2026-03-22', 80],
      ['2026-03-29', 82],
      ['2026-03-30', 100, true],
      ['2026-04-20', 78],
    ]),
  ]
  const result = compactWeeklyHistory(input, new Set())
  expect(result[0].points.map((point) => point.weeklySummary)).toEqual([
    'owner:2026-03-16',
    'owner:2026-03-23',
    undefined,
  ])
  expect(compactWeeklyHistory([], new Set())).toEqual([])
})

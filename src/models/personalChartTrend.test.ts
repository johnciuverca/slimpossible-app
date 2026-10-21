import { describe, expect, it } from 'vitest'
import { personalChartTrend } from './personalChartTrend'
import type { WeighIn } from './weighIn'
const point = (date: string, weightKg: number): WeighIn => ({
  date,
  weightKg,
  participantId: 'own',
})
describe('visible personal chart trend', () => {
  it('fits actual calendar spacing instead of treating sparse records as daily', () => {
    const result = personalChartTrend([
      point('2026-10-01', 100),
      point('2026-10-02', 99),
      point('2026-10-11', 90),
    ])!
    expect(result.firstWeightKg).toBeCloseTo(100)
    expect(result.lastWeightKg).toBeCloseTo(90)
  })
  it('uses only the supplied visible range', () => {
    const all = [
      point('2026-09-01', 20),
      point('2026-10-01', 100),
      point('2026-10-11', 90),
    ]
    expect(personalChartTrend(all.slice(1))).toEqual({
      firstWeightKg: 100,
      lastWeightKg: 90,
    })
    expect(personalChartTrend(all)?.firstWeightKg).not.toBe(100)
  })
  it('does not fabricate a trend for one date', () => {
    expect(personalChartTrend([point('2026-10-01', 100)])).toBeNull()
    expect(
      personalChartTrend([point('2026-10-01', 100), point('2026-10-01', 90)]),
    ).toBeNull()
  })
})

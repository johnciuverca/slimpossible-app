import { describe, expect, it } from 'vitest'
import { deriveGroupChartTrend } from './groupChartTrend'
import type { GroupChartPoint } from './groupChartHistory'

const point = (date: string, weightKg: number): GroupChartPoint => ({
  memberKey: 'selected-group-member',
  displayName: 'Fixture member',
  date,
  weightKg,
  changeKg: 0,
  previousSharedChangeKg: null,
})

describe('deriveGroupChartTrend', () => {
  it('fits a trend from irregularly spaced displayed points only', () => {
    expect(
      deriveGroupChartTrend([
        point('2026-01-01', 90),
        point('2026-01-02', 88),
        point('2026-01-04', 86),
      ]),
    ).toEqual({
      startDate: '2026-01-01',
      startWeightKg: 89.71,
      endDate: '2026-01-04',
      endWeightKg: 85.86,
    })
  })

  it('does not invent a trend for fewer than two distinct dates', () => {
    expect(deriveGroupChartTrend([point('2026-01-01', 90)])).toBeNull()
    expect(
      deriveGroupChartTrend([point('2026-01-01', 90), point('2026-01-01', 87)]),
    ).toBeNull()
  })
})

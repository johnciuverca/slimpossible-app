import type { GroupChartPoint } from './groupChartHistory'

export type GroupChartTrend = {
  startDate: string
  startWeightKg: number
  endDate: string
  endWeightKg: number
}

// A least-squares line using only the actual points currently shown for a member.
export function deriveGroupChartTrend(
  points: GroupChartPoint[],
): GroupChartTrend | null {
  const dated = [
    ...new Map(points.map((point) => [point.date, point])).values(),
  ]
    .filter((point) => Number.isFinite(point.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (dated.length < 2) return null

  const origin = Date.parse(`${dated[0].date}T00:00:00Z`) / 86400000
  const xs = dated.map(
    (point) => Date.parse(`${point.date}T00:00:00Z`) / 86400000 - origin,
  )
  const ys = dated.map((point) => point.weightKg)
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length
  const denominator = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0)
  if (!denominator) return null
  const slope =
    xs.reduce(
      (sum, value, index) => sum + (value - meanX) * (ys[index] - meanY),
      0,
    ) / denominator
  const intercept = meanY - slope * meanX
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    startDate: dated[0].date,
    startWeightKg: round(intercept),
    endDate: dated.at(-1)!.date,
    endWeightKg: round(intercept + slope * xs.at(-1)!),
  }
}

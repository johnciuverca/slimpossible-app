import type { WeighIn } from './weighIn'

/** Least-squares trend over only the points supplied to the visible chart. */
export function personalChartTrend(points: readonly WeighIn[]) {
  if (points.length < 2) return null
  const firstDay = Date.parse(`${points[0].date}T00:00:00Z`)
  const days = points.map(
    (point) => (Date.parse(`${point.date}T00:00:00Z`) - firstDay) / 86400000,
  )
  const meanDay = days.reduce((sum, day) => sum + day, 0) / days.length
  const meanWeight =
    points.reduce((sum, point) => sum + point.weightKg, 0) / points.length
  const variance = days.reduce((sum, day) => sum + (day - meanDay) ** 2, 0)
  if (!variance) return null
  const slope =
    points.reduce(
      (sum, point, index) =>
        sum + (days[index] - meanDay) * (point.weightKg - meanWeight),
      0,
    ) / variance
  return {
    firstWeightKg: meanWeight - slope * meanDay,
    lastWeightKg: meanWeight + slope * (days.at(-1)! - meanDay),
  }
}

import type { SharedChartSeries } from '../components/SharedWeightChart'

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
const dateAt = (value: number) =>
  new Date(value * 86400000).toISOString().slice(0, 10)
const monday = (value: number) =>
  value - ((new Date(value * 86400000).getUTCDay() + 6) % 7)

/** Presentation only: never mutates source points; bucket before range clipping. */
export function compactWeeklyHistory(
  series: SharedChartSeries[],
  expanded: ReadonlySet<string>,
) {
  const recorded = series.flatMap((member) =>
    member.points.filter((point) => !point.estimated),
  )
  if (!recorded.length) return series
  const cutoff = Math.max(...recorded.map((point) => day(point.date))) - 13
  return series.map((member) => {
    const buckets = new Map<number, typeof member.points>()
    for (const point of member.points) {
      if (point.estimated || day(point.date) >= cutoff) continue
      const start = monday(day(point.date))
      buckets.set(start, [...(buckets.get(start) ?? []), point])
    }
    const older = [...buckets].flatMap(([start, entries]) => {
      const key = `${member.id}:${dateAt(start)}`
      if (expanded.has(key))
        return member.points.filter(
          (point) =>
            monday(day(point.date)) === start && day(point.date) < cutoff,
        )
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
      const value =
        entries.reduce((sum, point) => sum + point.value, 0) / entries.length
      const coveredEnd = Math.min(start + 6, cutoff - 1)
      const details = `${member.title ?? member.id}: Weekly average ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} kg; ${dateAt(start)} to ${dateAt(coveredEnd)}; recorded dates ${sorted[0].date} to ${sorted.at(-1)!.date}; ${entries.length} recorded weigh-ins. Activate to expand daily points.`
      return [
        {
          date: sorted[0].date,
          value,
          title: details,
          tooltip: details,
          markerLabel: details,
          label: new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 2,
          }).format(value),
          weeklySummary: key,
        },
      ]
    })
    return {
      ...member,
      points: [
        ...older,
        ...member.points.filter((point) => day(point.date) >= cutoff),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }
  })
}

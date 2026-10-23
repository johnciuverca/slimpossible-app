import { useId } from 'react'
import type { WeighIn } from '../models/weighIn'
import { personalChartTrend } from '../models/personalChartTrend'
import { SharedWeightChart } from './SharedWeightChart'

const formatWeight = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

export function PersonalProgressChart({
  weighIns,
  referenceWeightKg,
  referenceLabel,
}: {
  weighIns: readonly WeighIn[]
  referenceWeightKg?: number
  referenceLabel?: string
}) {
  const id = useId()
  const chronological = [...weighIns].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const first = chronological[0]
  const latest = chronological.at(-1)
  if (!first || !latest) return null
  const trend = personalChartTrend(chronological)
  const reference =
    referenceWeightKg &&
    Number.isFinite(referenceWeightKg) &&
    referenceWeightKg > 0
      ? referenceWeightKg
      : null
  const weights = chronological.map((point) => point.weightKg)
  const padding = Math.max(
    (Math.max(...weights) - Math.min(...weights)) * 0.14,
    0.5,
  )
  const minimum = Math.floor((Math.min(...weights) - padding) * 2) / 2
  const maximum = Math.ceil((Math.max(...weights) + padding) * 2) / 2
  const points = chronological.map((point) => ({
    date: point.date,
    value: point.weightKg,
    label: formatWeight(point.weightKg),
    markerLabel: `Recorded weight on ${point.date}`,
    tooltip: `${point.date}: ${formatWeight(point.weightKg)} kg`,
    title: `${point.date}: ${formatWeight(point.weightKg)} kg recorded`,
  }))
  const lines = [
    ...(reference === null
      ? []
      : [
          {
            id: 'selected-reference',
            from: { date: first.date, value: reference },
            to: { date: latest.date, value: reference },
            color: 'var(--chart-reference, #8055ad)',
            title: `${referenceLabel ?? 'The selected goal target'} at ${formatWeight(reference)} kilograms`,
            kind: 'reference' as const,
          },
        ]),
    ...(trend === null
      ? []
      : [
          {
            id: 'personal-derived-trend',
            from: { date: first.date, value: trend.firstWeightKg },
            to: { date: latest.date, value: trend.lastWeightKg },
            color: 'var(--chart-trend, #a86312)',
            kind: 'trend' as const,
          },
        ]),
  ]
  const rangeDescription =
    first.date === latest.date
      ? `${first.date}, ${formatWeight(first.weightKg)} kilograms`
      : `${first.date}, ${formatWeight(first.weightKg)} kilograms to ${latest.date}, ${formatWeight(latest.weightKg)} kilograms`
  const referenceDescription =
    reference === null
      ? ''
      : ` ${referenceLabel ?? 'The selected goal target'} is ${formatWeight(reference)} kilograms. Its reference line is shown only when it fits within the data-scaled chart range; otherwise its value is noted below the chart.`
  return (
    <figure
      className="personal-weight-chart mt-5"
      aria-labelledby={`${id}-caption`}
    >
      <div
        className="overflow-x-auto"
        role="group"
        aria-label="Scrollable personal weight chart"
        tabIndex={0}
      >
        <SharedWeightChart
          title={`Personal weight history chart. ${points.length} saved weigh-ins, from ${rangeDescription}. Each point is a saved entry; no values are estimated.`}
          description={`Recorded points show saved dates and weights. The dashed trend is a least-squares fit of only these visible records, not additional weigh-ins. The solid line connects recorded weights.${referenceDescription} Private notes are never plotted.`}
          points={points}
          lines={lines}
          yLabel="Weight (kg)"
          adaptiveWeightTicks
          min={minimum}
          max={maximum}
          paddingRatio={0.14}
          paddingMinimum={0.5}
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted sm:hidden">
        Scroll sideways to see every recorded date.
      </p>
      <figcaption id={`${id}-caption`} className="sr-only">
        {points.length === 1
          ? 'One saved weigh-in is shown. Add another entry to compare your trend.'
          : `${points.length} saved weigh-ins from ${first.date} to ${latest.date}. No missing weights are estimated.`}
        {trend
          ? ' The trend summarizes these recorded points; it is not a saved weigh-in or a prediction.'
          : null}
      </figcaption>
    </figure>
  )
}

import { useId } from 'react'
import type { WeighIn } from '../models/weighIn'
import { personalChartTrend } from '../models/personalChartTrend'
import { formatChartDate } from '../models/chartDate'
import { SharedWeightChart } from './SharedWeightChart'
import { interpolateMissingWeights } from '../models/estimatedWeighIns'

const formatWeight = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

export function PersonalProgressChart({
  weighIns,
  referenceWeightKg,
  referenceLabel,
  fitContainer = false,
  labelExtremesOnly = false,
  compactOlderHistory = false,
  onPointActivate,
}: {
  weighIns: readonly WeighIn[]
  referenceWeightKg?: number
  referenceLabel?: string
  fitContainer?: boolean
  labelExtremesOnly?: boolean
  compactOlderHistory?: boolean
  onPointActivate?: (point: {
    date: string
    value: number
    estimated?: boolean
  }) => void
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
    markerLabel: `Recorded weight on ${formatChartDate(point.date)}`,
    tooltip: `${formatChartDate(point.date)}: ${formatWeight(point.weightKg)} kg`,
    title: `${formatChartDate(point.date)}: ${formatWeight(point.weightKg)} kg recorded`,
  }))
  const estimates = interpolateMissingWeights(chronological).map((point) => ({
    date: point.date,
    value: point.weightKg,
    estimated: true,
    markerLabel: `Estimated weight on ${formatChartDate(point.date)}`,
    tooltip: `Estimated — ${formatChartDate(point.date)}: ${formatWeight(point.weightKg)} kg`,
    title: `Estimated: ${formatChartDate(point.date)}, ${formatWeight(point.weightKg)} kg`,
  }))
  const plottedPoints = [...points, ...estimates].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
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
      ? `${formatChartDate(first.date)}, ${formatWeight(first.weightKg)} kilograms`
      : `${formatChartDate(first.date)}, ${formatWeight(first.weightKg)} kilograms to ${formatChartDate(latest.date)}, ${formatWeight(latest.weightKg)} kilograms`
  const referenceDescription =
    reference === null
      ? ''
      : ` ${referenceLabel ?? 'The selected goal target'} is ${formatWeight(reference)} kilograms. Its reference line is shown only when it fits within the data-scaled chart range; otherwise its value is noted below the chart.`
  return (
    <figure
      className="personal-weight-chart mt-5 w-full min-w-0"
      aria-labelledby={`${id}-caption`}
    >
      <div
        className={fitContainer ? 'w-full min-w-0' : 'overflow-x-auto'}
        role="group"
        aria-label={
          fitContainer
            ? 'Personal weight chart'
            : 'Scrollable personal weight chart'
        }
        tabIndex={fitContainer ? undefined : 0}
      >
        <SharedWeightChart
          compactOlderHistory={compactOlderHistory}
          title={`Personal weight history chart. ${points.length} saved weigh-ins, from ${rangeDescription}. Hollow points are daily estimates between saved entries.`}
          description={`${compactOlderHistory ? 'The latest seven calendar dates stay detailed; larger older points are weekly averages of actual saved records. Activate a week to expand daily points; Back to weekly averages restores compression. Solid daily points' : 'Solid points'} show saved dates and weights. Hollow points are estimates between saved entries and are not saved or used in the trend. Solid connecting lines show the interpolated daily path; estimated markers remain hollow. The trend uses only saved records.${referenceDescription} Private notes are never plotted.`}
          points={plottedPoints}
          onPointActivate={(point) => onPointActivate?.(point)}
          lines={lines}
          yLabel="Weight (kg)"
          adaptiveWeightTicks
          min={minimum}
          max={maximum}
          paddingRatio={0.14}
          paddingMinimum={0.5}
          fitContainer={fitContainer}
          labelExtremesOnly={labelExtremesOnly}
        />
      </div>
      {!fitContainer ? (
        <p className="mt-2 text-xs text-ink-muted sm:hidden">
          Scroll sideways to see every recorded date.
        </p>
      ) : null}
      <figcaption id={`${id}-caption`} className="sr-only">
        {points.length === 1
          ? 'One saved weigh-in is shown. Add another entry to compare your trend.'
          : `${points.length} saved weigh-ins from ${formatChartDate(first.date)} to ${formatChartDate(latest.date)}. Hollow points are display-only daily estimates.`}
        {trend
          ? ' The trend summarizes these recorded points; it is not a saved weigh-in or a prediction.'
          : null}
      </figcaption>
    </figure>
  )
}

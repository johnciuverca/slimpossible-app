import { useId } from 'react'
import type { WeighIn } from '../models/weighIn'
import { personalChartTrend } from '../models/personalChartTrend'

const left = 64,
  rightInset = 64,
  top = 36
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
  const first = chronological[0],
    latest = chronological.at(-1)
  if (!first || !latest) return null
  const trend = personalChartTrend(chronological)
  const reference =
    referenceWeightKg &&
    Number.isFinite(referenceWeightKg) &&
    referenceWeightKg > 0
      ? referenceWeightKg
      : null
  const weights = chronological.map((point) => point.weightKg)
  if (reference !== null) weights.push(reference)
  if (trend) weights.push(trend.firstWeightKg, trend.lastWeightKg)
  const padding = Math.max(
    (Math.max(...weights) - Math.min(...weights)) * 0.14,
    1,
  )
  const minimum = Math.floor(Math.min(...weights) - padding)
  const maximum = Math.ceil(Math.max(...weights) + padding)
  const tickWeights = Array.from(
    { length: maximum - minimum + 1 },
    (_, index) => minimum + index,
  )
  const chartWidth = Math.max(
    760,
    left + rightInset + Math.max(0, chronological.length - 1) * 18,
  )
  const right = chartWidth - rightInset
  const bottom = top + Math.max(178, (tickWeights.length - 1) * 24)
  const chartHeight = bottom + 52
  const yFor = (weight: number) =>
    bottom - ((weight - minimum) / (maximum - minimum)) * (bottom - top)
  const firstDay = Date.parse(`${first.date}T00:00:00Z`)
  const span = Date.parse(`${latest.date}T00:00:00Z`) - firstDay
  const points = chronological.map((point) => ({
    ...point,
    x: span
      ? left +
        ((Date.parse(`${point.date}T00:00:00Z`) - firstDay) / span) *
          (right - left)
      : (left + right) / 2,
    y: yFor(point.weightKg),
  }))
  const line = points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' ')
  const rangeDescription =
    first.date === latest.date
      ? `${first.date}, ${formatWeight(first.weightKg)} kilograms`
      : `${first.date}, ${formatWeight(first.weightKg)} kilograms to ${latest.date}, ${formatWeight(latest.weightKg)} kilograms`
  const referenceDescription =
    reference === null
      ? ''
      : ` The dashed reference line marks ${referenceLabel ?? 'the selected goal target'} at ${formatWeight(reference)} kilograms.`
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
        <svg
          role="img"
          aria-describedby={`${id}-description`}
          aria-label={`Personal weight history chart. ${points.length} saved weigh-ins, from ${rangeDescription}. Each numeric label above a dot is its exact recorded weight in kilograms; no values are estimated.${referenceDescription}`}
          className="block h-auto max-w-none"
          style={{ width: `${chartWidth}px` }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <title>Personal saved weigh-ins</title>
          <desc id={`${id}-description`}>
            The vertical axis shows weight in kilograms with ticks every 1
            kilogram. The solid line connects the exact saved weigh-ins. The
            dashed trend is a least-squares fit of only these visible records,
            not additional weigh-ins. Each numeric label above a dot is that
            point’s exact weight; focus a dot for its date and weight tooltip.
            Private notes are never plotted.{referenceDescription}
          </desc>
          <text x={left} y="17" className="chart-axis" fontSize="13">
            Weight (kg)
          </text>
          {tickWeights.map((weight) => {
            const y = yFor(weight)
            return (
              <g key={weight} data-chart-tick={weight}>
                <line
                  x1={left}
                  x2={right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-line)"
                />
                <text
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="chart-axis"
                  fontSize="12"
                >
                  {formatWeight(weight)}
                </text>
              </g>
            )
          })}
          {reference !== null ? (
            <line
              data-chart-reference
              x1={left}
              x2={right}
              y1={yFor(reference)}
              y2={yFor(reference)}
              stroke="var(--chart-reference, #8055ad)"
              strokeWidth="2"
              strokeDasharray="9 5"
            />
          ) : null}
          {points.length > 1 ? (
            <path
              d={line}
              fill="none"
              stroke="var(--chart-recorded, #087756)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          ) : null}
          {trend ? (
            <path
              data-chart-trend
              d={`M ${left} ${yFor(trend.firstWeightKg)} L ${right} ${yFor(trend.lastWeightKg)}`}
              fill="none"
              stroke="var(--chart-trend, #a86312)"
              strokeWidth="2"
              strokeDasharray="3 6"
            />
          ) : null}
          {points.map((point, index) => (
            <g key={`${point.date}-${index}`}>
              <circle
                tabIndex={0}
                cx={point.x}
                cy={point.y}
                r="5"
                data-date={point.date}
                data-weight-kg={point.weightKg}
                fill="var(--chart-recorded, #087756)"
                stroke="var(--color-panel)"
                strokeWidth="2"
              >
                <title>
                  {point.date}: {formatWeight(point.weightKg)} kg recorded
                </title>
              </circle>
              <text
                x={point.x}
                y={point.y - 8}
                textAnchor="middle"
                className="chart-value"
                fontSize="5"
                fontWeight="700"
                data-date={point.date}
                data-weight-kg={point.weightKg}
              >
                {formatWeight(point.weightKg)}
              </text>
            </g>
          ))}
          <text
            x={span ? left : (left + right) / 2}
            y={bottom + 33}
            textAnchor={span ? 'start' : 'middle'}
            className="chart-axis"
            fontSize="13"
          >
            {first.date}
          </text>
          {span ? (
            <text
              x={right}
              y={bottom + 33}
              textAnchor="end"
              className="chart-axis"
              fontSize="13"
            >
              {latest.date}
            </text>
          ) : null}
        </svg>
      </div>
      <p className="mt-2 text-xs text-ink-muted sm:hidden">
        Scroll sideways to see every recorded date.
      </p>
      <figcaption
        id={`${id}-caption`}
        className="mt-3 text-sm leading-6 text-ink-muted"
      >
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

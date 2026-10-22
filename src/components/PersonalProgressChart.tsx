import { useId } from 'react'
import type { WeighIn } from '../models/weighIn'
import { personalChartTrend } from '../models/personalChartTrend'

const chartWidth = 760
const chartHeight = 266
const left = 64
const right = chartWidth - 64
const top = 36
const bottom = 214
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
  const yFor = (weight: number) =>
    bottom - ((weight - minimum) / (maximum - minimum)) * (bottom - top)
  const firstDay = Date.parse(`${first.date}T00:00:00Z`)
  const latestDay = Date.parse(`${latest.date}T00:00:00Z`)
  const firstMonth = new Date(firstDay)
  const latestMonth = new Date(latestDay)
  const rangeStart = Date.UTC(
    firstMonth.getUTCFullYear(),
    firstMonth.getUTCMonth(),
    1,
  )
  const rangeEnd = Date.UTC(
    latestMonth.getUTCFullYear(),
    latestMonth.getUTCMonth() + 1,
    0,
  )
  const span = rangeEnd - rangeStart
  const dateTicks = Array.from(
    { length: Math.floor(span / (7 * 86400000)) + 1 },
    (_, index) => rangeStart + index * 7 * 86400000,
  )
  const points = chronological.map((point) => ({
    ...point,
    x:
      left +
      ((Date.parse(`${point.date}T00:00:00Z`) - rangeStart) / span) *
        (right - left),
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
          width={chartWidth}
          height={chartHeight}
          style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <title>Personal saved weigh-ins</title>
          <desc id={`${id}-description`}>
            The vertical axis shows weight in kilograms with ticks every 1
            kilogram. Dates use calendar-day positions and the horizontal axis
            is labeled weekly. The solid line connects the exact saved
            weigh-ins. The dashed trend is a least-squares fit of only these
            visible records, not additional weigh-ins. Each numeric label above
            a dot is that point’s exact weight; focus a dot for its date and
            weight tooltip. Private notes are never plotted.
            {referenceDescription}
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
              data-chart-area
              d={`${line} L ${points.at(-1)?.x} ${bottom} L ${points[0]?.x} ${bottom} Z`}
              fill="var(--chart-recorded, #087756)"
              opacity="0.1"
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
          {dateTicks.map((date) => {
            const x = left + ((date - rangeStart) / span) * (right - left)
            const label = new Intl.DateTimeFormat(undefined, {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }).format(date)
            return (
              <g
                key={date}
                data-chart-date-tick={new Date(date).toISOString().slice(0, 10)}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={bottom}
                  y2={bottom + 4}
                  stroke="var(--color-line)"
                />
                <text
                  x={x}
                  y={bottom + 16}
                  textAnchor={x === left ? 'start' : 'middle'}
                  className="chart-axis"
                  fontSize="8"
                >
                  {label}
                </text>
              </g>
            )
          })}
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

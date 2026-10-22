import { useId } from 'react'
import type { WeighIn } from '../models/weighIn'
import { personalChartTrend } from '../models/personalChartTrend'

const left = 64,
  right = 696,
  top = 36,
  bottom = 214
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
    0.5,
  )
  const minimum = Math.floor((Math.min(...weights) - padding) * 2) / 2
  const maximum = Math.ceil((Math.max(...weights) + padding) * 2) / 2
  const tickWeights = Array.from(
    { length: Math.floor(maximum - minimum + Number.EPSILON) + 1 },
    (_, index) => minimum + index,
  )
  const yFor = (weight: number) =>
    bottom - ((weight - minimum) / (maximum - minimum)) * (bottom - top)
  const firstDay = Date.parse(`${first.date}T00:00:00Z`)
  const span = Date.parse(`${latest.date}T00:00:00Z`) - firstDay
  const dateTicks = Array.from(
    { length: span ? Math.floor(span / (7 * 86400000)) + 1 : 1 },
    (_, index) => firstDay + index * 7 * 86400000,
  )
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
          aria-label={`Personal weight history chart. ${points.length} saved weigh-ins, from ${rangeDescription}. Each point is a saved entry; no values are estimated.`}
          className="block h-auto w-full min-w-[600px]"
          viewBox="0 0 760 266"
        >
          <title>Personal saved weigh-ins</title>
          <desc id={`${id}-description`}>
            Recorded points show saved dates and weights. The dashed trend is a
            least-squares fit of only these visible records, not additional
            weigh-ins. The solid line connects recorded weights.
            {referenceDescription} Private notes are never plotted.
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
              opacity="0.35"
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
                x={
                  point.x +
                  (index === 0 ? 8 : index === points.length - 1 ? -8 : 0)
                }
                y={point.y - 12}
                textAnchor={
                  index === 0
                    ? 'start'
                    : index === points.length - 1
                      ? 'end'
                      : 'middle'
                }
                className="chart-value"
                fontSize="6.6"
                fontWeight="700"
                data-date={point.date}
                data-weight-kg={point.weightKg}
              >
                {formatWeight(point.weightKg)}
              </text>
            </g>
          ))}
          {dateTicks.map((date, index) => {
            const x = span
              ? left + ((date - firstDay) / span) * (right - left)
              : (left + right) / 2
            const textAnchor =
              dateTicks.length === 1
                ? 'middle'
                : index === 0
                  ? 'start'
                  : index === dateTicks.length - 1
                    ? 'end'
                    : 'middle'
            return (
              <text
                key={date}
                x={x}
                y="247"
                textAnchor={textAnchor}
                className="chart-axis"
                fontSize="6.5"
                data-chart-date-tick={new Date(date).toISOString().slice(0, 10)}
              >
                {new Date(date).toISOString().slice(0, 10)}
              </text>
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

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
  const minimum = Math.min(...weights) - padding,
    maximum = Math.max(...weights) + padding
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
            weigh-ins. Private notes are never plotted.
          </desc>
          <text x={left} y="17" className="chart-axis" fontSize="13">
            Weight (kg)
          </text>
          {Array.from({ length: 5 }, (_, index) => {
            const weight = minimum + ((maximum - minimum) * index) / 4
            const y = yFor(weight)
            return (
              <g key={index}>
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
              {index === 0 || index === points.length - 1 ? (
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
                  fontSize="12"
                  fontWeight="700"
                >
                  {formatWeight(point.weightKg)} kg · recorded
                </text>
              ) : null}
            </g>
          ))}
          <text
            x={span ? left : (left + right) / 2}
            y="247"
            textAnchor={span ? 'start' : 'middle'}
            className="chart-axis"
            fontSize="13"
          >
            {first.date}
          </text>
          {span ? (
            <text
              x={right}
              y="247"
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
      <ul
        className="chart-legend mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"
        aria-label="Personal chart legend"
      >
        <li>
          <span className="legend-recorded" />
          Recorded weights
        </li>
        {trend ? (
          <li>
            <span className="legend-trend" />
            Derived trend
          </li>
        ) : null}
        {reference !== null ? (
          <li>
            <span className="legend-reference" />
            {referenceLabel ?? 'Selected goal target'}:{' '}
            {formatWeight(reference)} kg
          </li>
        ) : null}
      </ul>
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

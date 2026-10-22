import type { ReactNode } from 'react'

export type SharedChartPoint = {
  date: string
  value: number
  title: ReactNode
  label?: string
  markerLabel?: string
}

export type SharedChartSeries = {
  id: string
  color: string
  points: SharedChartPoint[]
  connectGaps?: boolean
  dashed?: boolean
  title?: string
}

export type SharedChartLine = {
  id: string
  from: { date: string; value: number }
  to: { date: string; value: number }
  color: string
  title?: string
  kind: 'trend' | 'reference'
}

const left = 64
const right = 696
const top = 36
const bottom = 214
const day = (date: string) => Date.parse(`${date}T00:00:00Z`)
const format = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

/** Shared chart presentation only; callers retain ownership of data and semantics. */
export function SharedWeightChart({
  title,
  description,
  points = [],
  series = [],
  lines = [],
  yLabel,
  min,
  max,
  maxTicks = 24,
  className = 'block h-auto w-full min-w-[600px]',
  viewBox = '0 0 760 266',
}: {
  title: string
  description: ReactNode
  points?: SharedChartPoint[]
  series?: SharedChartSeries[]
  lines?: SharedChartLine[]
  yLabel: string
  min: number
  max: number
  maxTicks?: number
  className?: string
  viewBox?: string
}) {
  const plotted = [...(points ?? []), ...series.flatMap((item) => item.points)]
  if (!plotted.length) return null
  const firstDay = Math.min(...plotted.map((point) => day(point.date)))
  const lastDay = Math.max(...plotted.map((point) => day(point.date)))
  const span = lastDay - firstDay
  const x = (date: string) =>
    span
      ? left + ((day(date) - firstDay) / span) * (right - left)
      : (left + right) / 2
  const labelAnchor = (date: string) =>
    span === 0
      ? 'middle'
      : day(date) === firstDay
        ? 'start'
        : day(date) === lastDay
          ? 'end'
          : 'middle'
  const labelX = (date: string) =>
    x(date) +
    (labelAnchor(date) === 'start' ? 8 : labelAnchor(date) === 'end' ? -8 : 0)
  const y = (value: number) =>
    bottom - ((value - min) / (max - min)) * (bottom - top)
  const tickStep = Math.max(1, Math.ceil((max - min) / maxTicks))
  const firstTick = Math.ceil(min / tickStep) * tickStep
  const ticks = Array.from(
    {
      length: Math.max(
        0,
        Math.floor((max - firstTick + Number.EPSILON) / tickStep) + 1,
      ),
    },
    (_, index) => firstTick + index * tickStep,
  )
  const dates = Array.from(
    { length: span ? Math.floor(span / (7 * 86400000)) + 1 : 1 },
    (_, index) => firstDay + index * 7 * 86400000,
  )
  const pathFor = (items: SharedChartPoint[]) =>
    items
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`,
      )
      .join(' ')
  return (
    <svg
      role="img"
      aria-label={title}
      aria-description={
        typeof description === 'string' ? description : undefined
      }
      className={className}
      viewBox={viewBox}
    >
      <title>{title}</title>
      <desc>{description}</desc>
      <text x={left} y="17" className="chart-axis" fontSize="13">
        {yLabel}
      </text>
      {ticks.map((value) => (
        <g key={value} data-chart-tick={value}>
          <line
            x1={left}
            x2={right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--color-line, #cbd5e1)"
          />
          <text
            x={left - 10}
            y={y(value) + 4}
            textAnchor="end"
            className="chart-axis"
            fontSize="12"
          >
            {format(value)}
          </text>
        </g>
      ))}
      {lines.map((line) => {
        const yy = line.kind === 'reference' ? y(line.from.value) : undefined
        return (
          <line
            key={line.id}
            data-series={
              line.kind === 'trend' ? 'derived-trend' : 'target-reference'
            }
            data-chart-line-kind={line.kind}
            data-chart-trend={line.kind === 'trend' ? '' : undefined}
            data-chart-reference={line.kind === 'reference' ? '' : undefined}
            x1={x(line.from.date)}
            y1={yy ?? y(line.from.value)}
            x2={x(line.to.date)}
            y2={yy ?? y(line.to.value)}
            stroke={line.color}
            strokeWidth="2"
            strokeDasharray={line.kind === 'trend' ? '3 6' : '9 5'}
            opacity={line.kind === 'trend' ? 0.35 : undefined}
          >
            {line.title ? <title>{line.title}</title> : null}
          </line>
        )
      })}
      {points.length > 1 ? (
        <path
          d={pathFor(points)}
          fill="none"
          stroke="var(--chart-recorded, #087756)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ) : null}
      {series.map((item) => (
        <g key={item.id}>
          {item.points.length > 1 &&
          item.points.some(
            (point, index) =>
              index > 0 &&
              (item.connectGaps ||
                day(point.date) - day(item.points[index - 1].date) ===
                  86400000),
          ) ? (
            <path
              data-series="recorded-connection"
              d={item.points
                .map(
                  (point, index) =>
                    `${index && (item.connectGaps || day(point.date) - day(item.points[index - 1].date) === 86400000) ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`,
                )
                .join(' ')}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? '5 3' : undefined}
            >
              {item.title ? <title>{item.title}</title> : null}
            </path>
          ) : null}
          {item.points.map((point, index) => (
            <g key={`${point.date}-${index}`}>
              <circle
                cx={x(point.date)}
                cy={y(point.value)}
                r="5"
                fill={item.color}
                stroke="var(--color-panel, white)"
                strokeWidth="2"
                data-date={point.date}
                data-value={point.value}
                aria-label={point.markerLabel}
                tabIndex={0}
              >
                <title>{point.title}</title>
              </circle>
              {point.label ? (
                <text
                  x={labelX(point.date)}
                  y={y(point.value) - 12}
                  textAnchor={labelAnchor(point.date)}
                  className="chart-value"
                  fontSize="6.6"
                  fontWeight="700"
                  data-date={point.date}
                  data-value={point.value}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      ))}
      {points.map((point, index) => (
        <g key={`${point.date}-${index}`}>
          <circle
            tabIndex={0}
            cx={x(point.date)}
            cy={y(point.value)}
            r="5"
            data-date={point.date}
            data-weight-kg={point.value}
            fill="var(--chart-recorded, #087756)"
            stroke="var(--color-panel)"
            strokeWidth="2"
          >
            <title>{point.title}</title>
          </circle>
          {point.label ? (
            <text
              x={labelX(point.date)}
              y={y(point.value) - 12}
              textAnchor={labelAnchor(point.date)}
              className="chart-value"
              fontSize="6.6"
              fontWeight="700"
              data-date={point.date}
              data-weight-kg={point.value}
            >
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
      {dates.map((date, index) => (
        <text
          key={date}
          x={x(new Date(date).toISOString().slice(0, 10))}
          y="247"
          textAnchor={
            dates.length === 1
              ? 'middle'
              : index === 0
                ? 'start'
                : index === dates.length - 1
                  ? 'end'
                  : 'middle'
          }
          className="chart-axis"
          fontSize="6.5"
          data-chart-date-tick={new Date(date).toISOString().slice(0, 10)}
        >
          {new Date(date).toISOString().slice(0, 10)}
        </text>
      ))}
    </svg>
  )
}

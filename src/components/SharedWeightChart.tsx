import { useId, useState, type ReactNode } from 'react'

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
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
const dateAtDay = (value: number) =>
  new Date(value * 86400000).toISOString().slice(0, 10)
const shiftMonths = (value: number, months: number) => {
  const date = new Date(value * 86400000)
  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() - months)
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()
  date.setUTCDate(Math.min(originalDay, daysInMonth))
  return Math.floor(date.getTime() / 86400000)
}
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
  paddingRatio = 0,
  paddingMinimum = 0.5,
  floorAtZero = false,
  includeZero = false,
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
  paddingRatio?: number
  paddingMinimum?: number
  floorAtZero?: boolean
  includeZero?: boolean
  className?: string
  viewBox?: string
}) {
  const rangeId = useId()
  const [selectedRange, setSelectedRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const plotted = [...(points ?? []), ...series.flatMap((item) => item.points)]
  if (!plotted.length) return null
  const firstDay = Math.min(...plotted.map((point) => day(point.date)))
  const lastDay = Math.max(...plotted.map((point) => day(point.date)))
  const startDay = selectedRange
    ? Math.max(firstDay, Math.min(lastDay, selectedRange.start))
    : firstDay
  const endDay = selectedRange
    ? Math.max(startDay, Math.min(lastDay, selectedRange.end))
    : lastDay
  const fullRange = startDay === firstDay && endDay === lastDay
  const span = endDay - startDay
  const x = (date: string) =>
    span
      ? left + ((day(date) - startDay) / span) * (right - left)
      : (left + right) / 2
  const labelAnchor = (date: string) =>
    span === 0
      ? 'middle'
      : day(date) === startDay
        ? 'start'
        : day(date) === endDay
          ? 'end'
          : 'middle'
  const labelX = (date: string) =>
    x(date) +
    (labelAnchor(date) === 'start' ? 8 : labelAnchor(date) === 'end' ? -8 : 0)
  const inRange = (date: string) => day(date) >= startDay && day(date) <= endDay
  const visiblePoints = points.filter((point) => inRange(point.date))
  const visibleSeries = series.map((item) => ({
    ...item,
    points: item.points.filter((point) => inRange(point.date)),
  }))
  const visibleLines = lines.flatMap((line) => {
    const lineStart = day(line.from.date)
    const lineEnd = day(line.to.date)
    const low = Math.min(lineStart, lineEnd)
    const high = Math.max(lineStart, lineEnd)
    const clippedStart = Math.max(startDay, low)
    const clippedEnd = Math.min(endDay, high)
    if (clippedStart > clippedEnd) return []
    const valueAt = (value: number) => {
      const fraction =
        lineEnd === lineStart ? 0 : (value - lineStart) / (lineEnd - lineStart)
      return line.from.value + fraction * (line.to.value - line.from.value)
    }
    return [
      {
        ...line,
        from: { date: dateAtDay(clippedStart), value: valueAt(clippedStart) },
        to: { date: dateAtDay(clippedEnd), value: valueAt(clippedEnd) },
      },
    ]
  })
  let yMinimum = min
  let yMaximum = max
  if (!fullRange) {
    const viewValues = [
      ...visiblePoints.map((point) => point.value),
      ...visibleSeries.flatMap((item) =>
        item.points.map((point) => point.value),
      ),
      ...visibleLines.flatMap((line) => [line.from.value, line.to.value]),
      ...(includeZero ? [0] : []),
    ]
    if (viewValues.length) {
      const low = Math.min(...viewValues)
      const high = Math.max(...viewValues)
      const padding = Math.max(paddingMinimum, (high - low) * paddingRatio)
      yMinimum = Math.floor((low - padding) * 2) / 2
      yMaximum = Math.ceil((high + padding) * 2) / 2
      if (floorAtZero) yMinimum = Math.max(0, yMinimum)
      if (yMaximum <= yMinimum) yMaximum = yMinimum + 1
    }
  }
  const y = (value: number) =>
    bottom - ((value - yMinimum) / (yMaximum - yMinimum)) * (bottom - top)
  const tickStep = Math.max(1, Math.ceil((yMaximum - yMinimum) / maxTicks))
  const firstTick = Math.ceil(yMinimum / tickStep) * tickStep
  const ticks = Array.from(
    {
      length: Math.max(
        0,
        Math.floor((yMaximum - firstTick + Number.EPSILON) / tickStep) + 1,
      ),
    },
    (_, index) => firstTick + index * tickStep,
  )
  const dates = Array.from(
    { length: span ? Math.floor(span / 7) + 1 : 1 },
    (_, index) => startDay + index * 7,
  )
  const pathFor = (items: SharedChartPoint[]) =>
    items
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`,
      )
      .join(' ')
  const oneMonthStart = Math.max(firstDay, shiftMonths(lastDay, 1))
  const threeMonthStart = Math.max(firstDay, shiftMonths(lastDay, 3))
  const visibleCount =
    visiblePoints.length +
    visibleSeries.reduce((sum, item) => sum + item.points.length, 0)
  const totalCount =
    points.length + series.reduce((sum, item) => sum + item.points.length, 0)
  const chartTitle = fullRange
    ? title
    : `${title}. Showing ${visibleCount} of ${totalCount} recorded entries from ${dateAtDay(startDay)} to ${dateAtDay(endDay)}.`
  return (
    <div className="w-full min-w-0">
      <div
        role="group"
        aria-label="Chart date range controls"
        className="mb-3 flex w-full flex-wrap items-center gap-2 text-sm"
      >
        <span className="font-semibold text-ink">Date range</span>
        <button
          type="button"
          aria-label="Show last 1 month"
          aria-pressed={endDay === lastDay && startDay === oneMonthStart}
          disabled={firstDay === lastDay}
          onClick={() =>
            setSelectedRange({ start: oneMonthStart, end: lastDay })
          }
          className="min-h-9 rounded-full border border-line bg-page px-3 text-ink hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
        >
          1M
        </button>
        <button
          type="button"
          aria-label="Show last 3 months"
          aria-pressed={endDay === lastDay && startDay === threeMonthStart}
          disabled={firstDay === lastDay}
          onClick={() =>
            setSelectedRange({ start: threeMonthStart, end: lastDay })
          }
          className="min-h-9 rounded-full border border-line bg-page px-3 text-ink hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
        >
          3M
        </button>
        <button
          type="button"
          aria-label="Show all dates"
          aria-pressed={fullRange}
          disabled={fullRange}
          onClick={() => setSelectedRange(null)}
          className="min-h-9 rounded-full border border-line bg-page px-3 text-ink hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
        >
          All
        </button>
        <label
          htmlFor={`${rangeId}-start`}
          className="flex min-h-9 items-center gap-2"
        >
          <span>From</span>
          <input
            id={`${rangeId}-start`}
            aria-label="Visible range start"
            aria-valuetext={dateAtDay(startDay)}
            type="range"
            min={firstDay}
            max={lastDay}
            step={1}
            value={startDay}
            disabled={firstDay === lastDay}
            onChange={(event) =>
              setSelectedRange({
                start: Math.min(Number(event.target.value), endDay),
                end: endDay,
              })
            }
            className="w-24 accent-emerald-700 sm:w-32"
          />
        </label>
        <label
          htmlFor={`${rangeId}-end`}
          className="flex min-h-9 items-center gap-2"
        >
          <span>To</span>
          <input
            id={`${rangeId}-end`}
            aria-label="Visible range end"
            aria-valuetext={dateAtDay(endDay)}
            type="range"
            min={firstDay}
            max={lastDay}
            step={1}
            value={endDay}
            disabled={firstDay === lastDay}
            onChange={(event) =>
              setSelectedRange({
                start: startDay,
                end: Math.max(Number(event.target.value), startDay),
              })
            }
            className="w-24 accent-emerald-700 sm:w-32"
          />
        </label>
        <output
          aria-label="Visible date range"
          aria-live="polite"
          className="text-xs text-ink-muted"
        >
          {dateAtDay(startDay)} – {dateAtDay(endDay)}
        </output>
      </div>
      <svg
        role="img"
        aria-label={chartTitle}
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
        {visibleLines.map((line) => {
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
        {visiblePoints.length > 1 ? (
          <path
            d={pathFor(visiblePoints)}
            fill="none"
            stroke="var(--chart-recorded, #087756)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        ) : null}
        {visibleSeries.map((item) => (
          <g key={item.id}>
            {item.points.length > 1 &&
            item.points.some(
              (point, index) =>
                index > 0 &&
                (item.connectGaps ||
                  day(point.date) - day(item.points[index - 1].date) === 1),
            ) ? (
              <path
                data-series="recorded-connection"
                d={item.points
                  .map(
                    (point, index) =>
                      `${index && (item.connectGaps || day(point.date) - day(item.points[index - 1].date) === 1) ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`,
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
        {visiblePoints.map((point, index) => (
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
            x={x(dateAtDay(date))}
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
            data-chart-date-tick={dateAtDay(date)}
          >
            {dateAtDay(date)}
          </text>
        ))}
      </svg>
    </div>
  )
}

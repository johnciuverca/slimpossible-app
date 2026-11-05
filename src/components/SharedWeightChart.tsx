import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { layoutChartValueLabels } from '../models/chartValueLabelLayout'
import { formatChartDate } from '../models/chartDate'

export type SharedChartPoint = {
  date: string
  value: number
  title: ReactNode
  tooltip?: ReactNode
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
  extremeLabelPrefix?: string
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
  adaptiveWeightTicks = false,
  floorAtZero = false,
  includeZero = false,
  fitContainer = false,
  labelExtremesOnly = false,
  labelSeriesExtremesOnly = false,
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
  adaptiveWeightTicks?: boolean
  floorAtZero?: boolean
  includeZero?: boolean
  fitContainer?: boolean
  labelExtremesOnly?: boolean
  labelSeriesExtremesOnly?: boolean
  className?: string
  viewBox?: string
}) {
  const [compactFitLayout, setCompactFitLayout] = useState(
    () =>
      fitContainer && typeof window !== 'undefined' && window.innerWidth <= 600,
  )
  useEffect(() => {
    if (!fitContainer) {
      setCompactFitLayout(false)
      return
    }
    const media = window.matchMedia?.('(max-width: 600px)')
    const update = () =>
      setCompactFitLayout(media?.matches ?? window.innerWidth <= 600)
    update()
    if (media) {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [fitContainer])
  const compactLayout = fitContainer && compactFitLayout
  const chartLeft = compactLayout ? 48 : left
  let chartRight = compactLayout ? 312 : right
  const chartTop = top
  const chartViewBox = compactLayout ? '0 0 320 266' : viewBox
  const chartClassName = fitContainer
    ? className.replace('min-w-[600px]', 'min-w-0')
    : className
  const chartFrameClassName = fitContainer
    ? 'w-full min-w-0 pt-2'
    : 'w-full min-w-[600px] pt-2'
  const rangeId = useId()
  const tooltipId = useId()
  const rangeTrackRef = useRef<HTMLDivElement>(null)
  const [activePoint, setActivePoint] = useState<{
    id: string
    source: 'pointer' | 'focus' | 'touch'
  } | null>(null)
  useEffect(() => {
    if (activePoint?.source !== 'touch') return
    const dismissOutsidePoint = (event: PointerEvent) => {
      if (
        event.pointerType === 'touch' &&
        !(
          event.target instanceof Element &&
          event.target.closest('[data-chart-point]')
        )
      )
        setActivePoint(null)
    }
    document.addEventListener('pointerdown', dismissOutsidePoint)
    return () =>
      document.removeEventListener('pointerdown', dismissOutsidePoint)
  }, [activePoint])
  const [selectedRange, setSelectedRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<
    '1w' | '2w' | '1m' | '3m' | 'all' | 'custom'
  >('all')
  const plotted = [...(points ?? []), ...series.flatMap((item) => item.points)]
  if (!plotted.length) return null
  const firstDay = Math.min(...plotted.map((point) => day(point.date)))
  const lastDay = Math.max(...plotted.map((point) => day(point.date)))
  const oneWeekStart = Math.max(firstDay, lastDay - 6)
  const twoWeekStart = Math.max(firstDay, lastDay - 13)
  const oneMonthStart = Math.max(firstDay, shiftMonths(lastDay, 1))
  const threeMonthStart = Math.max(firstDay, shiftMonths(lastDay, 3))
  const customStart = selectedRange
    ? Math.max(firstDay, Math.min(lastDay, selectedRange.start))
    : firstDay
  const customEnd = selectedRange
    ? Math.max(customStart, Math.min(lastDay, selectedRange.end))
    : lastDay
  const startDay =
    selectedPreset === '1w'
      ? oneWeekStart
      : selectedPreset === '2w'
        ? twoWeekStart
        : selectedPreset === '1m'
          ? oneMonthStart
          : selectedPreset === '3m'
            ? threeMonthStart
            : selectedPreset === 'custom'
              ? customStart
              : firstDay
  const endDay = selectedPreset === 'custom' ? customEnd : lastDay
  const fullRange = startDay === firstDay && endDay === lastDay
  const span = endDay - startDay
  const x = (date: string) =>
    span
      ? chartLeft + ((day(date) - startDay) / span) * (chartRight - chartLeft)
      : (chartLeft + chartRight) / 2
  const inRange = (date: string) => day(date) >= startDay && day(date) <= endDay
  const visiblePoints = points.filter((point) => inRange(point.date))
  const extremeLabelPointIds = new Set<string>()
  if (labelExtremesOnly && visiblePoints.length) {
    const values = visiblePoints.map((point) => point.value)
    const minimumValue = Math.min(...values)
    const maximumValue = Math.max(...values)
    const minimumIndex = values.indexOf(minimumValue)
    const maximumIndex = values.indexOf(maximumValue)
    extremeLabelPointIds.add(
      `point:${visiblePoints[minimumIndex].date}:${minimumIndex}`,
    )
    if (maximumValue !== minimumValue) {
      extremeLabelPointIds.add(
        `point:${visiblePoints[maximumIndex].date}:${maximumIndex}`,
      )
    }
  }
  const pointLabelX = (point: SharedChartPoint) => {
    const pointX = x(point.date)
    if (!labelExtremesOnly || !compactLayout || !point.label) return pointX
    const halfLabelWidth = (point.label.length * 5.4) / 2
    return Math.max(
      chartLeft + halfLabelWidth + 2,
      Math.min(pointX, chartRight - halfLabelWidth - 2),
    )
  }
  const seriesLabelX = (item: SharedChartSeries, point: SharedChartPoint) => {
    const pointX = x(point.date)
    if (!labelSeriesExtremesOnly || !point.label) return pointX
    const text = item.extremeLabelPrefix
      ? `${item.extremeLabelPrefix}: ${point.label}`
      : point.label
    const halfLabelWidth = (text.length * (compactLayout ? 5.4 : 4.2)) / 2
    return Math.max(
      chartLeft + halfLabelWidth + 2,
      Math.min(pointX, chartRight - halfLabelWidth - 2),
    )
  }
  const visibleSeries = series.map((item) => ({
    ...item,
    points: item.points.filter((point) => inRange(point.date)),
  }))
  const extremeSeriesPointIds = new Set<string>()
  if (labelSeriesExtremesOnly) {
    visibleSeries.forEach((item) => {
      if (!item.points.length) return
      const values = item.points.map((point) => point.value)
      const minimumIndex = values.indexOf(Math.min(...values))
      const maximumIndex = values.indexOf(Math.max(...values))
      extremeSeriesPointIds.add(
        `series:${item.id}:${item.points[minimumIndex].date}:${minimumIndex}`,
      )
      if (values[minimumIndex] !== values[maximumIndex])
        extremeSeriesPointIds.add(
          `series:${item.id}:${item.points[maximumIndex].date}:${maximumIndex}`,
        )
    })
  }
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
  const tooltipTargets = [
    ...visiblePoints.map((point, index) => ({
      id: `point:${point.date}:${index}`,
      point,
    })),
    ...visibleSeries.flatMap((item) =>
      item.points.map((point, index) => ({
        id: `series:${item.id}:${point.date}:${index}`,
        point,
      })),
    ),
  ]
  const visibleActivePoint = activePoint
    ? tooltipTargets.find((target) => target.id === activePoint.id)
    : undefined
  let yMinimum = min
  let yMaximum = max
  if (!fullRange) {
    const viewValues = [
      ...visiblePoints.map((point) => point.value),
      ...visibleSeries.flatMap((item) =>
        item.points.map((point) => point.value),
      ),
      ...(!adaptiveWeightTicks
        ? visibleLines.flatMap((line) => [line.from.value, line.to.value])
        : []),
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
  const visibleWeightValues = [
    ...visiblePoints.map((point) => point.value),
    ...visibleSeries.flatMap((item) => item.points.map((point) => point.value)),
  ]
  const useFiveKgTicks =
    adaptiveWeightTicks &&
    visibleWeightValues.length > 0 &&
    Math.max(...visibleWeightValues) - Math.min(...visibleWeightValues) > 8
  if (useFiveKgTicks) {
    yMinimum = Math.floor(yMinimum / 5) * 5
    yMaximum = Math.ceil(yMaximum / 5) * 5
    if (yMaximum <= yMinimum) yMaximum = yMinimum + 5
  }
  const tickStep = useFiveKgTicks
    ? 5
    : Math.max(
        1,
        Math.ceil((yMaximum - yMinimum) / (compactLayout ? 8 : maxTicks)),
      )
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
  const viewBoxParts = chartViewBox.trim().split(/\s+/).map(Number)
  const viewBoxWidth = viewBoxParts[2] || 760
  const viewBoxHeight = viewBoxParts[3] || 266
  const compactYAxisLabelWidth = compactLayout
    ? Math.max(0, ...ticks.map((value) => format(value).length * 7.2))
    : 0
  if (compactLayout) {
    chartRight = viewBoxWidth - (chartLeft - 10 - compactYAxisLabelWidth)
  }
  const plotBottom = viewBoxHeight - 52
  const y = (value: number) =>
    plotBottom -
    ((value - yMinimum) / (yMaximum - yMinimum)) * (plotBottom - chartTop)
  const chartValueLabelPositions = new Map(
    layoutChartValueLabels(
      [
        ...visibleSeries.flatMap((item) =>
          item.points.flatMap((point, index) =>
            point.label &&
            (!labelSeriesExtremesOnly ||
              extremeSeriesPointIds.has(
                `series:${item.id}:${point.date}:${index}`,
              ))
              ? [
                  {
                    id: `series:${item.id}:${point.date}:${index}`,
                    x: seriesLabelX(item, point),
                    pointY: y(point.value),
                    text: item.extremeLabelPrefix
                      ? `${item.extremeLabelPrefix}: ${point.label}`
                      : point.label,
                  },
                ]
              : [],
          ),
        ),
        ...visiblePoints.flatMap((point, index) =>
          point.label &&
          (!labelExtremesOnly ||
            extremeLabelPointIds.has(`point:${point.date}:${index}`))
            ? [
                {
                  id: `point:${point.date}:${index}`,
                  x: pointLabelX(point),
                  pointY: y(point.value),
                  text: point.label,
                },
              ]
            : [],
        ),
      ],
      viewBoxWidth,
      viewBoxHeight,
      labelExtremesOnly && compactLayout ? 5.4 : undefined,
    ).map(({ id, x: labelX, y: labelY }) => [id, { x: labelX, y: labelY }]),
  )
  const valueLabelPosition = (
    pointId: string,
    pointX: number,
    pointY: number,
  ) => chartValueLabelPositions.get(pointId) ?? { x: pointX, y: pointY - 12 }
  const referenceLinesOutsideRange = adaptiveWeightTicks
    ? visibleLines.filter(
        (line) =>
          line.kind === 'reference' &&
          (line.from.value < yMinimum ||
            line.from.value > yMaximum ||
            line.to.value < yMinimum ||
            line.to.value > yMaximum),
      )
    : []
  const renderedLines = visibleLines.filter(
    (line) => !referenceLinesOutsideRange.includes(line),
  )
  const minorTicks = useFiveKgTicks
    ? Array.from(
        { length: Math.max(0, Math.ceil(yMaximum - yMinimum) - 1) },
        (_, index) => yMinimum + index + 1,
      ).filter((value) => value < yMaximum && value % 5 !== 0)
    : []
  const tooltipPosition = visibleActivePoint
    ? {
        x: x(visibleActivePoint.point.date),
        y: y(visibleActivePoint.point.value),
      }
    : null
  const tooltipAlignment = tooltipPosition
    ? tooltipPosition.x < chartLeft + (compactLayout ? 56 : 110)
      ? 'start'
      : tooltipPosition.x > chartRight - (compactLayout ? 56 : 110)
        ? 'end'
        : 'center'
    : 'center'
  const tooltipTransform = `translate(${tooltipAlignment === 'start' ? '0' : tooltipAlignment === 'end' ? '-100%' : '-50%'}, ${tooltipPosition && tooltipPosition.y < chartTop + 52 ? '10px' : 'calc(-100% - 10px)'})`
  const setPointSource = (
    event: ReactPointerEvent<SVGCircleElement>,
    id: string,
  ) => {
    setActivePoint({
      id,
      source: event.pointerType === 'touch' ? 'touch' : 'pointer',
    })
  }
  const selectTouchPoint = (
    event: ReactPointerEvent<SVGCircleElement>,
    id: string,
  ) => {
    if (event.pointerType === 'touch') setActivePoint({ id, source: 'touch' })
  }
  const compactDateTickCount = Math.min(4, Math.ceil(span / 120) + 1)
  const dates = compactLayout
    ? Array.from({ length: span ? compactDateTickCount : 1 }, (_, index) =>
        compactDateTickCount === 1
          ? startDay
          : Math.round(startDay + (span * index) / (compactDateTickCount - 1)),
      ).filter((date, index, allDates) => allDates.indexOf(date) === index)
    : Array.from(
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
  const visibleCount =
    visiblePoints.length +
    visibleSeries.reduce((sum, item) => sum + item.points.length, 0)
  const totalCount =
    points.length + series.reduce((sum, item) => sum + item.points.length, 0)
  const chartTitle = fullRange
    ? title
    : `${title}. Showing ${visibleCount} of ${totalCount} recorded entries from ${formatChartDate(dateAtDay(startDay))} to ${formatChartDate(dateAtDay(endDay))}.`
  const selectedRangeLabel =
    selectedPreset === '1w'
      ? 'Last 7 days'
      : selectedPreset === '2w'
        ? 'Last 14 days'
        : selectedPreset === '1m'
          ? 'Last month'
          : selectedPreset === '3m'
            ? 'Last 3 months'
            : selectedPreset === 'custom'
              ? 'Selected dates'
              : 'All recorded dates'
  const rangePercent = (value: number) =>
    span === 0 ? 0 : ((value - firstDay) / (lastDay - firstDay)) * 100
  const plotStartPercent = (chartLeft / viewBoxWidth) * 100
  const plotWidthPercent = ((chartRight - chartLeft) / viewBoxWidth) * 100
  const compactContentInsetPercent =
    ((chartLeft - 10 - compactYAxisLabelWidth) / viewBoxWidth) * 100 + 0.5
  const compactContentWidthPercent = 100 - compactContentInsetPercent * 2
  const setThumbValue = (thumb: 'start' | 'end', value: number) => {
    if (thumb === 'start') {
      setSelectedRange({ start: Math.min(value, endDay), end: endDay })
    } else {
      setSelectedRange({ start: startDay, end: Math.max(value, startDay) })
    }
    const nextStart = thumb === 'start' ? Math.min(value, endDay) : startDay
    const nextEnd = thumb === 'end' ? Math.max(value, startDay) : endDay
    setSelectedPreset(
      nextStart === firstDay && nextEnd === lastDay ? 'all' : 'custom',
    )
  }
  const presetClass = (selected: boolean) =>
    `min-h-9 rounded-full border px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 ${selected ? 'border-emerald-800 bg-emerald-800 font-semibold text-white shadow-sm hover:bg-emerald-900 dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950' : 'border-line bg-page text-ink hover:bg-panel'}`
  const choosePreset = (preset: typeof selectedPreset, start: number) => {
    setSelectedPreset(preset)
    setSelectedRange({ start, end: lastDay })
  }
  const moveThumbFromPointer = (thumb: 'start' | 'end', clientX: number) => {
    const bounds = rangeTrackRef.current?.getBoundingClientRect()
    if (!bounds || lastDay === firstDay) return
    const usableWidth = Math.max(1, bounds.width)
    const percent = Math.max(
      0,
      Math.min(1, (clientX - bounds.left) / usableWidth),
    )
    setThumbValue(thumb, Math.round(firstDay + percent * (lastDay - firstDay)))
  }
  const renderThumb = (thumb: 'start' | 'end') => {
    const isStart = thumb === 'start'
    const value = isStart ? startDay : endDay
    const thumbMin = isStart ? firstDay : startDay
    const thumbMax = isStart ? endDay : lastDay
    return (
      <button
        id={`${rangeId}-${thumb}`}
        key={thumb}
        type="button"
        role="slider"
        aria-label={isStart ? 'Visible range start' : 'Visible range end'}
        aria-valuemin={thumbMin}
        aria-valuemax={thumbMax}
        aria-valuenow={value}
        aria-valuetext={formatChartDate(dateAtDay(value))}
        aria-orientation="horizontal"
        disabled={firstDay === lastDay}
        className={`date-range-handle date-range-handle-${thumb}`}
        style={{ left: `${rangePercent(value)}%` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          moveThumbFromPointer(thumb, event.clientX)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            moveThumbFromPointer(thumb, event.clientX)
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 7 : 1
          let nextValue: number | null = null
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
            nextValue = value - step
          else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
            nextValue = value + step
          else if (event.key === 'PageDown') nextValue = value - 7
          else if (event.key === 'PageUp') nextValue = value + 7
          else if (event.key === 'Home') nextValue = thumbMin
          else if (event.key === 'End') nextValue = thumbMax
          if (nextValue !== null) {
            event.preventDefault()
            setThumbValue(
              thumb,
              Math.max(thumbMin, Math.min(thumbMax, nextValue)),
            )
          }
        }}
      />
    )
  }
  return (
    <div
      className={chartFrameClassName}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setActivePoint(null)
      }}
    >
      <div
        role="group"
        aria-label="Chart date range controls"
        className="w-full text-sm"
      >
        <div
          role="group"
          className={`mb-3 flex w-full flex-wrap items-center gap-2 ${compactLayout ? 'justify-center' : ''}`}
          aria-label="Quick date ranges"
          style={
            compactLayout ? undefined : { paddingLeft: `${plotStartPercent}%` }
          }
        >
          <span
            className={`${compactLayout ? 'w-full text-center' : 'mr-1'} font-semibold text-ink`}
          >
            Date range
          </span>
          <button
            type="button"
            aria-label="Show last 1 week"
            aria-pressed={selectedPreset === '1w'}
            disabled={firstDay === lastDay}
            onClick={() => choosePreset('1w', oneWeekStart)}
            className={presetClass(selectedPreset === '1w')}
          >
            1W
          </button>
          <button
            type="button"
            aria-label="Show last 2 weeks"
            aria-pressed={selectedPreset === '2w'}
            disabled={firstDay === lastDay}
            onClick={() => choosePreset('2w', twoWeekStart)}
            className={presetClass(selectedPreset === '2w')}
          >
            2W
          </button>
          <button
            type="button"
            aria-label="Show last 1 month"
            aria-pressed={selectedPreset === '1m'}
            disabled={firstDay === lastDay}
            onClick={() => choosePreset('1m', oneMonthStart)}
            className={presetClass(selectedPreset === '1m')}
          >
            1M
          </button>
          <button
            type="button"
            aria-label="Show last 3 months"
            aria-pressed={selectedPreset === '3m'}
            disabled={firstDay === lastDay}
            onClick={() => choosePreset('3m', threeMonthStart)}
            className={presetClass(selectedPreset === '3m')}
          >
            3M
          </button>
          <button
            type="button"
            aria-label="Show all dates"
            aria-pressed={selectedPreset === 'all'}
            disabled={selectedPreset === 'all'}
            onClick={() => choosePreset('all', firstDay)}
            className={presetClass(selectedPreset === 'all')}
          >
            All
          </button>
        </div>
      </div>
      <div
        className="relative"
        onPointerLeave={() => {
          if (activePoint?.source === 'pointer') setActivePoint(null)
        }}
      >
        <svg
          role="img"
          aria-label={chartTitle}
          aria-description={
            typeof description === 'string' ? description : undefined
          }
          className={chartClassName}
          viewBox={chartViewBox}
        >
          <title>{title}</title>
          <desc>{description}</desc>
          <text x={chartLeft} y="17" className="chart-axis" fontSize="13">
            {yLabel}
          </text>
          {minorTicks.map((value) => (
            <line
              key={value}
              data-chart-minor-tick={value}
              aria-hidden="true"
              x1={chartLeft}
              x2={chartRight}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--color-line, #cbd5e1)"
              strokeWidth="0.75"
              opacity="0.45"
            />
          ))}
          {ticks.map((value) => (
            <g key={value} data-chart-tick={value}>
              <line
                x1={chartLeft}
                x2={chartRight}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--color-line, #cbd5e1)"
              />
              <text
                x={chartLeft - 10}
                y={y(value) + 4}
                textAnchor="end"
                className="chart-axis"
                fontSize={compactLayout ? '13' : '12'}
              >
                {format(value)}
              </text>
            </g>
          ))}
          {renderedLines.map((line) => {
            const yy =
              line.kind === 'reference' ? y(line.from.value) : undefined
            return (
              <line
                key={line.id}
                data-series={
                  line.kind === 'trend' ? 'derived-trend' : 'target-reference'
                }
                data-chart-line-kind={line.kind}
                data-chart-trend={line.kind === 'trend' ? '' : undefined}
                data-chart-reference={
                  line.kind === 'reference' ? '' : undefined
                }
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
              {item.points.map((point, index) => {
                const pointId = `series:${item.id}:${point.date}:${index}`
                const labelPosition = valueLabelPosition(
                  pointId,
                  seriesLabelX(item, point),
                  y(point.value),
                )
                const showSeriesLabel =
                  !labelSeriesExtremesOnly || extremeSeriesPointIds.has(pointId)
                return (
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
                      aria-describedby={
                        activePoint?.id === pointId ? tooltipId : undefined
                      }
                      role="button"
                      tabIndex={0}
                      data-chart-point
                      onPointerEnter={(event) => setPointSource(event, pointId)}
                      onPointerDown={(event) =>
                        selectTouchPoint(event, pointId)
                      }
                      onFocus={() =>
                        setActivePoint((current) =>
                          current?.id === pointId && current.source === 'touch'
                            ? current
                            : { id: pointId, source: 'focus' },
                        )
                      }
                      onBlur={() =>
                        setActivePoint((current) =>
                          current?.id === pointId && current.source === 'focus'
                            ? null
                            : current,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setActivePoint(null)
                        else if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setActivePoint({ id: pointId, source: 'focus' })
                        }
                      }}
                    >
                      <title>{point.title}</title>
                    </circle>
                    {point.label && showSeriesLabel ? (
                      <text
                        x={labelPosition.x}
                        y={labelPosition.y}
                        textAnchor="middle"
                        className="chart-value"
                        fontSize={compactLayout ? '9' : '6.6'}
                        fontWeight="700"
                        data-date={point.date}
                        data-value={point.value}
                      >
                        {item.extremeLabelPrefix
                          ? `${item.extremeLabelPrefix}: ${point.label}`
                          : point.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          ))}
          {visiblePoints.map((point, index) => {
            const pointId = `point:${point.date}:${index}`
            const labelPosition = valueLabelPosition(
              pointId,
              pointLabelX(point),
              y(point.value),
            )
            return (
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
                  aria-label={point.markerLabel ?? 'Recorded weight point'}
                  aria-describedby={
                    activePoint?.id === pointId ? tooltipId : undefined
                  }
                  role="button"
                  data-chart-point
                  onPointerEnter={(event) => setPointSource(event, pointId)}
                  onPointerDown={(event) => selectTouchPoint(event, pointId)}
                  onFocus={() =>
                    setActivePoint((current) =>
                      current?.id === pointId && current.source === 'touch'
                        ? current
                        : { id: pointId, source: 'focus' },
                    )
                  }
                  onBlur={() =>
                    setActivePoint((current) =>
                      current?.id === pointId && current.source === 'focus'
                        ? null
                        : current,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setActivePoint(null)
                    else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setActivePoint({ id: pointId, source: 'focus' })
                    }
                  }}
                >
                  <title>{point.title}</title>
                </circle>
                {point.label &&
                (!labelExtremesOnly || extremeLabelPointIds.has(pointId)) ? (
                  <text
                    x={labelPosition.x}
                    y={labelPosition.y}
                    textAnchor="middle"
                    className="chart-value"
                    fontSize={compactLayout ? '9' : '6.6'}
                    fontWeight="700"
                    data-date={point.date}
                    data-weight-kg={point.value}
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            )
          })}
          {dates.map((date, index) => (
            <text
              key={date}
              x={x(dateAtDay(date))}
              y={viewBoxHeight - 19}
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
              fontSize={compactLayout ? '10' : '6.5'}
              data-chart-date-tick={dateAtDay(date)}
            >
              {formatChartDate(dateAtDay(date))}
            </text>
          ))}
        </svg>
        {visibleActivePoint && tooltipPosition ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute z-10 max-w-[min(14rem,90vw)] rounded-lg border border-line bg-panel px-3 py-2 text-xs font-semibold text-ink shadow-panel"
            style={{
              left: `${(tooltipPosition.x / viewBoxWidth) * 100}%`,
              top: `${(tooltipPosition.y / viewBoxHeight) * 100}%`,
              transform: tooltipTransform,
            }}
          >
            {visibleActivePoint.point.tooltip ?? visibleActivePoint.point.title}
          </div>
        ) : null}
      </div>
      <div
        className={`mt-2 ${compactLayout ? '' : 'px-2'}`}
        style={{
          marginLeft: `${compactLayout ? compactContentInsetPercent : plotStartPercent}%`,
          width: `${compactLayout ? compactContentWidthPercent : plotWidthPercent}%`,
        }}
      >
        <output
          aria-label="Visible date range"
          aria-live="polite"
          className="mb-1 block text-center text-xs text-ink-muted"
        >
          <span className="font-semibold text-ink">{selectedRangeLabel}</span>
          <span aria-hidden="true"> · </span>
          {formatChartDate(dateAtDay(startDay))} –{' '}
          {formatChartDate(dateAtDay(endDay))}
        </output>
        <div
          className="relative h-8 touch-none"
          role="group"
          aria-label="Adjust visible date range"
        >
          <div ref={rangeTrackRef} className="absolute inset-0">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line">
              <div
                className="absolute inset-y-0 rounded-full bg-emerald-700"
                style={{
                  left: `${rangePercent(startDay)}%`,
                  width: `${rangePercent(endDay) - rangePercent(startDay)}%`,
                }}
              />
            </div>
            {renderThumb('start')}
            {renderThumb('end')}
          </div>
        </div>
      </div>
    </div>
  )
}

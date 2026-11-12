import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SharedWeightChart } from './SharedWeightChart'
import { sharedChartTheme } from './sharedChartTheme'

afterEach(cleanup)

it('retains overlapping weekly means in narrow ranges and connects summaries to recent daily points', () => {
  const { container } = render(
    <SharedWeightChart
      title="Ranges"
      description="History"
      yLabel="kg"
      min={70}
      max={90}
      compactOlderHistory
      lines={[
        {
          id: 'trend',
          kind: 'trend',
          color: 'orange',
          from: { date: '2026-09-01', value: 80 },
          to: { date: '2026-09-22', value: 77 },
        },
      ]}
      series={[
        {
          id: 'a',
          color: 'green',
          points: [
            { date: '2026-09-01', value: 80, title: 'First' },
            {
              date: '2026-09-03',
              value: 82,
              title: 'Second',
              markerLabel: 'Original September third',
            },
            { date: '2026-09-08', value: 79, title: 'Boundary week' },
            { date: '2026-09-09', value: 78, title: 'Recent boundary' },
            { date: '2026-09-22', value: 77, title: 'Newest' },
          ],
        },
      ]}
    />,
  )
  expect(
    container.querySelectorAll('path[data-series="weekly-summary-connection"]'),
  ).toHaveLength(2)
  const trendSegments = Array.from(
    container.querySelectorAll('line[data-chart-line-kind="trend"]'),
  )
  expect(trendSegments).toHaveLength(9)
  const segmentWidths = trendSegments.map(
    (line) => Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
  )
  for (const width of segmentWidths)
    expect(width).toBeCloseTo(segmentWidths[0], 4)
  const start = screen.getByRole('slider', { name: 'Visible range start' })
  fireEvent.keyDown(start, { key: 'ArrowRight' })
  fireEvent.keyDown(start, { key: 'ArrowRight' })
  const summary = screen.getByRole('button', { name: /Weekly average 81 kg/ })
  expect(summary).toHaveAttribute('data-date', '2026-09-03')
  expect(summary).toHaveAttribute(
    'aria-label',
    expect.stringContaining('01.09.2026 to 03.09.2026'),
  )
  fireEvent.click(summary)
  expect(
    screen.getByRole('button', { name: /^Expand week$/ }),
  ).toBeInTheDocument()
  expect(
    container.querySelector('circle[data-date="2026-09-03"][data-chart-point]'),
  ).toHaveAttribute('data-point-kind', 'weekly-summary')
  fireEvent.click(screen.getByRole('button', { name: /^Expand week$/ }))
  expect(
    screen.getByRole('button', { name: 'Original September third' }),
  ).toHaveAttribute('data-value', '82')
  fireEvent.click(
    screen.getByRole('button', { name: 'Back to weekly averages' }),
  )
  expect(
    screen.getByRole('button', { name: /Weekly average 81 kg/ }),
  ).toHaveAttribute('data-value', '81')
  expect(
    screen.getByRole('button', { name: /Weekly average 81 kg/ }),
  ).toHaveFocus()
})

it('requires explicit actions to expand weekly summaries and edit daily points', () => {
  const activate = vi.fn()
  render(
    <SharedWeightChart
      title="Weekly history"
      description="History"
      yLabel="kg"
      min={70}
      max={90}
      compactOlderHistory
      onPointActivate={activate}
      series={[
        {
          id: 'owner',
          color: 'green',
          points: [
            {
              date: '2026-09-01',
              value: 80,
              title: 'First',
              markerLabel: 'Original own point',
            },
            { date: '2026-09-02', value: 82, title: 'Second' },
            { date: '2026-11-10', value: 75, title: 'Newest' },
          ],
        },
      ]}
    />,
  )
  const summary = screen.getByRole('button', {
    name: /Weekly average 81 kg/,
  })
  expect(summary).toHaveAttribute('data-point-kind', 'weekly-summary')
  fireEvent.keyDown(summary, { key: 'Enter' })
  expect(activate).not.toHaveBeenCalled()
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    /^31\.08\.2026 – 06\.09\.2026$/,
  )
  expect(screen.getByRole('tooltip')).not.toHaveTextContent(
    /Weekly average|recorded weigh-ins|Expand week/,
  )
  expect(
    screen.getByRole('group', {
      name: /Weekly average 81 kg.*2 recorded weigh-ins/,
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Expand week$/ })).toHaveFocus()
  const expandWeek = screen.getByRole('button', { name: /^Expand week$/ })
  expect(expandWeek).toHaveClass('bg-transparent', 'min-h-11', 'min-w-11')
  expect(expandWeek.querySelector('span')).toHaveClass(
    'bg-forest-800',
    'text-[#072b22]',
    'text-[0.5rem]',
  )
  fireEvent.click(screen.getByRole('button', { name: /^Expand week$/ }))
  const daily = screen.getByRole('button', { name: 'Original own point' })
  fireEvent.click(daily)
  expect(activate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Edit weight$/ }))
  expect(activate).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2026-09-01', value: 80 }),
    'owner',
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Back to weekly averages' }),
  )
  expect(
    screen.getByRole('button', { name: /Weekly average 81 kg/ }),
  ).toBeInTheDocument()
})

it('marks estimates as hollow and requires an explicit Record weight action', () => {
  const onPointActivate = vi.fn()
  render(
    <SharedWeightChart
      title="Estimated history"
      description="Saved points and estimates."
      yLabel="Weight (kg)"
      min={80}
      max={90}
      onPointActivate={onPointActivate}
      points={[
        {
          date: '2026-11-01',
          value: 90,
          title: 'Saved',
          markerLabel: 'Recorded weight',
        },
        {
          date: '2026-11-02',
          value: 89.75,
          estimated: true,
          title: 'Estimated',
          markerLabel: 'Estimated weight on 2 Nov',
          tooltip: 'Estimated — 89.75 kg',
        },
        {
          date: '2026-11-03',
          value: 89.5,
          title: 'Saved again',
          markerLabel: 'Recorded weight',
        },
      ]}
    />,
  )
  const estimate = screen.getByRole('button', {
    name: 'Estimated weight on 2 Nov',
  })
  expect(
    Array.from(
      screen
        .getByRole('img', { name: /Estimated history/ })
        .querySelectorAll('circle[data-point-kind]'),
      (point) => point.getAttribute('data-point-kind'),
    ),
  ).toEqual(['estimated', 'recorded', 'recorded'])
  expect(estimate).toHaveAttribute('data-point-kind', 'estimated')
  expect(estimate).toHaveAttribute('fill', 'var(--color-panel, white)')
  const chart = screen.getByRole('img', { name: /Estimated history/ })
  const connections = chart.querySelectorAll('path[data-series$="connection"]')
  expect(connections).toHaveLength(2)
  for (const connection of connections) {
    expect(connection).not.toHaveAttribute('stroke-dasharray')
    expect(connection).not.toHaveAttribute('opacity')
  }
  expect(estimate).toHaveAttribute('opacity', '0.72')
  expect(estimate.querySelector('title')).toHaveTextContent('Estimated')
  fireEvent.keyDown(estimate, { key: 'Enter' })
  expect(onPointActivate).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /^Record weight$/ })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /^Record weight$/ }))
  expect(onPointActivate).toHaveBeenCalledWith(
    expect.objectContaining({
      date: '2026-11-02',
      value: 89.75,
      estimated: true,
    }),
    undefined,
  )
  fireEvent.click(estimate)
  expect(onPointActivate).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: /^Record weight$/ }))
  expect(onPointActivate).toHaveBeenCalledTimes(2)
})

it('shares axis, weekly date ticks, numeric labels and exact tooltips without bridging missing days', () => {
  render(
    <SharedWeightChart
      title="Shared weight chart"
      description="Only explicitly recorded entries are shown."
      yLabel="Weight (kg)"
      min={80}
      max={90}
      series={[
        {
          id: 'member-a',
          color: '#31dbb0',
          points: [
            {
              date: '2026-10-01',
              value: 90,
              label: '90',
              title: 'Member: 90 kg',
            },
            {
              date: '2026-10-03',
              value: 88,
              label: '88',
              title: 'Member: 88 kg',
            },
          ],
        },
      ]}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Shared weight chart' })
  expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(2)
  expect(chart.querySelectorAll('.chart-value')).toHaveLength(2)
  expect(chart.querySelectorAll('[data-chart-tick]')).toHaveLength(11)
  expect(chart.querySelectorAll('[data-chart-date-tick]')).toHaveLength(1)
  expect(chart.querySelector('[data-chart-date-tick]')).toHaveTextContent(
    '01.10.2026',
  )
  expect(chart.querySelector('[data-series="recorded-connection"]')).toBeNull()
  expect(chart.querySelector('circle title')).toHaveTextContent('Member: 90 kg')
})

it('keeps member-series connections solid and fully opaque through estimates', () => {
  render(
    <SharedWeightChart
      title="Estimated member series"
      description="Recorded and estimated member weights."
      yLabel="Weight (kg)"
      min={80}
      max={90}
      series={[
        {
          id: 'member-a',
          color: '#31dbb0',
          points: [
            { date: '2026-11-01', value: 90, title: 'Saved' },
            {
              date: '2026-11-02',
              value: 89.75,
              estimated: true,
              title: 'Estimated — 89.75 kg',
              tooltip: 'Estimated — 89.75 kg',
            },
            { date: '2026-11-03', value: 89.5, title: 'Saved again' },
          ],
        },
      ]}
    />,
  )

  const chart = screen.getByRole('img', { name: 'Estimated member series' })
  const connections = chart.querySelectorAll('path[data-series$="connection"]')
  expect(connections).toHaveLength(2)
  for (const connection of connections) {
    expect(connection).not.toHaveAttribute('stroke-dasharray')
    expect(connection).not.toHaveAttribute('opacity')
  }
  const estimate = chart.querySelector('circle[data-point-kind="estimated"]')
  expect(estimate).toHaveAttribute('fill', 'var(--color-panel, white)')
  expect(estimate).toHaveAttribute('opacity', '0.72')
  expect(estimate?.querySelector('title')).toHaveTextContent(
    'Estimated — 89.75 kg',
  )
})

it('centers endpoint values on their own dots and staggers a crowded run vertically', () => {
  render(
    <SharedWeightChart
      title="Centered value labels"
      description="Recorded weights."
      yLabel="Weight (kg)"
      min={80}
      max={100}
      points={[
        { date: '2026-01-01', value: 90, label: '90', title: 'First: 90 kg' },
        { date: '2026-01-02', value: 90, label: '90', title: 'Second: 90 kg' },
        { date: '2026-01-03', value: 90, label: '90', title: 'Third: 90 kg' },
        { date: '2026-04-01', value: 85, label: '85', title: 'Last: 85 kg' },
      ]}
    />,
  )

  const chart = screen.getByRole('img', { name: 'Centered value labels' })
  const labels = Array.from(
    chart.querySelectorAll<SVGTextElement>('.chart-value'),
  )
  expect(labels).toHaveLength(4)
  for (const label of labels) {
    const point = chart.querySelector(
      `circle[data-chart-point][data-date="${label.dataset.date}"]`,
    )
    expect(label).toHaveAttribute('text-anchor', 'middle')
    expect(label.getAttribute('x')).toBe(point?.getAttribute('cx'))
    expect(Number(label.getAttribute('y'))).toBeLessThan(
      Number(point?.getAttribute('cy')),
    )
  }

  const clusteredRows = labels
    .filter((label) =>
      ['2026-01-01', '2026-01-02', '2026-01-03'].includes(
        label.dataset.date ?? '',
      ),
    )
    .map((label) => Number(label.getAttribute('y')))
  expect(clusteredRows[0]).not.toBe(clusteredRows[1])
  expect(clusteredRows[1]).not.toBe(clusteredRows[2])
  expect(clusteredRows.every((row) => row > 0)).toBe(true)
})

it('centers a one-point member label over its point at the shared chart edge', () => {
  render(
    <SharedWeightChart
      title="Members"
      description="Shared records only."
      yLabel="Weight (kg)"
      min={70}
      max={100}
      maxTicks={8}
      series={[
        {
          id: 'long-history',
          color: '#31dbb0',
          points: [
            { date: '2026-10-01', value: 90, title: 'first', label: '90' },
            { date: '2026-10-03', value: 89, title: 'last', label: '89' },
          ],
        },
        {
          id: 'single-latest',
          color: '#67a5ff',
          points: [
            { date: '2026-10-03', value: 75, title: 'single', label: '75' },
          ],
        },
      ]}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Members' })
  const label = chart.querySelector(
    'text[data-date="2026-10-03"][data-value="75"]',
  )
  expect(label).toHaveAttribute('text-anchor', 'middle')
  expect(Number(label?.getAttribute('x'))).toBe(736)
})

it('shows stable interactive point details with keyboard focus and outside dismissal', () => {
  const onPointActivate = vi.fn()
  render(
    <SharedWeightChart
      title="Point detail chart"
      description="Saved entries only."
      yLabel="Weight (kg)"
      min={80}
      max={90}
      points={[
        {
          date: '2026-10-01',
          value: 86.25,
          title: 'native title only',
          markerLabel: 'Recorded weight point',
          tooltip: (
            <span className="whitespace-nowrap">2026-10-01: 86.25 kg</span>
          ),
        },
      ]}
      onPointActivate={onPointActivate}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Point detail chart' })
  const point = chart.querySelector('circle[data-chart-point]')!
  const details = () =>
    screen.getByRole('group', { name: /Chart point details/ })
  const expectTooltip = () => {
    const panel = details()
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('2026-10-01: 86.25 kg')
    expect(tooltip).toHaveClass('text-[0.53125rem]')
    expect(panel).toHaveClass('bg-panel', 'border-line', 'shadow-panel')
    expect(point).toHaveAttribute('aria-describedby', tooltip.id)
  }

  fireEvent.pointerEnter(point, { pointerType: 'mouse' })
  expectTooltip()
  fireEvent.pointerLeave(chart.parentElement!, { pointerType: 'mouse' })
  expect(
    screen.queryByRole('group', { name: /Chart point details/ }),
  ).toBeNull()

  fireEvent.focus(point)
  expectTooltip()
  fireEvent.keyDown(point, { key: 'Enter' })
  expect(onPointActivate).not.toHaveBeenCalled()
  const edit = screen.getByRole('button', { name: /^Edit weight$/ })
  expect(edit).toHaveFocus()
  fireEvent.keyDown(edit, { key: 'Escape' })
  expect(
    screen.queryByRole('group', { name: /Chart point details/ }),
  ).toBeNull()
  expect(point).toHaveFocus()
  expect(point).toHaveAttribute('style', 'outline: none;')
  expect(chart.querySelector('[data-point-highlight]')).toBeInTheDocument()

  fireEvent.pointerDown(point, { pointerType: 'touch' })
  expectTooltip()
  fireEvent.pointerDown(
    screen.getByRole('group', { name: 'Quick date ranges' }),
    {
      pointerType: 'touch',
    },
  )
  expect(
    screen.queryByRole('group', { name: /Chart point details/ }),
  ).toBeNull()
})

it('applies date ranges and sliders, clips trends, and suppresses reference lines', () => {
  const dates = [
    '2026-01-01',
    '2026-02-01',
    '2026-03-01',
    '2026-04-01',
    '2026-05-01',
  ]
  const points = dates.map((date, index) => ({
    date,
    value: 90 - index,
    title: `${date}: ${90 - index} kg`,
    label: String(90 - index),
  }))
  render(
    <SharedWeightChart
      title="Date range chart"
      description="Only saved records are shown."
      yLabel="Weight (kg)"
      min={80}
      max={95}
      paddingRatio={0.1}
      points={points}
      lines={[
        {
          id: 'goal',
          from: { date: dates[0], value: 82 },
          to: { date: dates.at(-1)!, value: 82 },
          color: '#8055ad',
          kind: 'reference',
        },
        {
          id: 'trend',
          from: { date: dates[0], value: 90 },
          to: { date: dates.at(-1)!, value: 86 },
          color: '#a86312',
          kind: 'trend',
        },
      ]}
    />,
  )
  const chart = () => screen.getByRole('img', { name: /Date range chart/ })
  const range = screen.getByRole('group', { name: 'Chart date range controls' })
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(5)

  fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(2)
  expect(chart().querySelectorAll('[data-chart-tick]')).not.toHaveLength(0)
  expect(chart().querySelector('[data-chart-reference]')).toBeNull()
  expect(chart().querySelector('[data-chart-trend]')).toHaveAttribute(
    'x1',
    '44',
  )
  expect(chart().querySelector('[data-chart-trend]')).not.toHaveAttribute(
    'stroke-dasharray',
  )
  expect(chart().querySelector('[data-chart-trend]')).toHaveAttribute(
    'opacity',
    String(sharedChartTheme.trendOpacity),
  )
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    '01.04.2026 – 01.05.2026',
  )
  expect(points).toHaveLength(5)

  fireEvent.click(screen.getByRole('button', { name: 'Show last 3 months' }))
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(5)

  const sliders = screen.getAllByRole('slider')
  expect(sliders).toHaveLength(2)
  const start = screen.getByRole('slider', { name: 'Visible range start' })
  const end = screen.getByRole('slider', { name: 'Visible range end' })
  fireEvent.keyDown(start, { key: 'ArrowRight' })
  expect(range).toBeInTheDocument()
  expect(start).toHaveAttribute('aria-valuetext', '02.01.2026')
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(4)
  fireEvent.keyDown(end, { key: 'ArrowLeft' })
  expect(end).toHaveAttribute('aria-valuetext', '30.04.2026')
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    '02.01.2026 – 30.04.2026',
  )
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(3)
})

it('selects inclusive 7-day and 14-day windows anchored on the newest saved date', () => {
  render(
    <SharedWeightChart
      title="Weight history"
      description="Saved entries only."
      yLabel="Weight (kg)"
      min={70}
      max={100}
      points={[
        { date: '2024-02-19', value: 90, title: '19 Feb' },
        { date: '2024-02-20', value: 89, title: '20 Feb' },
        { date: '2024-02-29', value: 88, title: '29 Feb' },
        { date: '2024-03-04', value: 87, title: '4 Mar' },
      ]}
    />,
  )
  const chart = () => screen.getByRole('img', { name: /Weight history/ })
  const oneWeek = screen.getByRole('button', { name: 'Show last 1 week' })
  const twoWeeks = screen.getByRole('button', { name: 'Show last 2 weeks' })

  fireEvent.click(oneWeek)
  expect(oneWeek).toHaveAttribute('aria-pressed', 'true')
  expect(twoWeeks).toHaveAttribute('aria-pressed', 'false')
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(2)
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    'Last 7 days · 27.02.2024 – 04.03.2024',
  )
  expect(
    screen.getByRole('slider', { name: 'Visible range start' }),
  ).toHaveAttribute('aria-valuetext', '27.02.2024')

  fireEvent.click(twoWeeks)
  expect(twoWeeks).toHaveAttribute('aria-pressed', 'true')
  expect(oneWeek).toHaveAttribute('aria-pressed', 'false')
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(3)
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    'Last 14 days · 20.02.2024 – 04.03.2024',
  )
})

it('keeps the chosen quick range selected when a short history clamps to its first date', () => {
  render(
    <SharedWeightChart
      title="Short history"
      description="Two saved entries."
      yLabel="Weight (kg)"
      min={70}
      max={100}
      points={[
        { date: '2024-03-03', value: 90, title: '3 Mar' },
        { date: '2024-03-04', value: 89, title: '4 Mar' },
      ]}
    />,
  )
  const oneWeek = screen.getByRole('button', { name: 'Show last 1 week' })
  const twoWeeks = screen.getByRole('button', { name: 'Show last 2 weeks' })
  const all = screen.getByRole('button', { name: 'Show all dates' })

  fireEvent.click(oneWeek)
  expect(oneWeek).toHaveAttribute('aria-pressed', 'true')
  expect(all).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(twoWeeks)
  expect(twoWeeks).toHaveAttribute('aria-pressed', 'true')
  expect(oneWeek).toHaveAttribute('aria-pressed', 'false')
})

it('keeps valid axes and accessible dates when keyboard sliders select an empty gap', () => {
  render(
    <SharedWeightChart
      title="Sparse history"
      description="Only saved entries are shown."
      yLabel="Weight (kg)"
      min={70}
      max={100}
      points={[
        { date: '2024-03-01', value: 90, title: '1 Mar' },
        { date: '2024-03-10', value: 89, title: '10 Mar' },
        { date: '2024-03-20', value: 88, title: '20 Mar' },
      ]}
    />,
  )
  const chart = () => screen.getByRole('img', { name: /Sparse history/ })
  const start = screen.getByRole('slider', { name: 'Visible range start' })
  const end = screen.getByRole('slider', { name: 'Visible range end' })

  for (let index = 0; index < 10; index += 1)
    fireEvent.keyDown(start, { key: 'ArrowRight' })
  fireEvent.keyDown(end, { key: 'Home' })

  expect(start).toHaveAttribute('aria-valuetext', '11.03.2024')
  expect(end).toHaveAttribute('aria-valuetext', '11.03.2024')
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    '11.03.2024 – 11.03.2024',
  )
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(0)
  expect(chart().querySelectorAll('[data-chart-tick]').length).toBeGreaterThan(
    0,
  )
})

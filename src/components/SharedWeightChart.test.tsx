import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { SharedWeightChart } from './SharedWeightChart'

afterEach(cleanup)

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
  expect(Number(label?.getAttribute('x'))).toBe(696)
})

it('shows an accessible themed point tooltip on hover, keyboard focus, and touch', () => {
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
          tooltip: '2026-10-01: 86.25 kg',
        },
      ]}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Point detail chart' })
  const point = chart.querySelector('circle[data-chart-point]')!
  const expectTooltip = () => {
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('2026-10-01: 86.25 kg')
    expect(tooltip).toHaveClass('bg-panel', 'border-line', 'shadow-panel')
    expect(point).toHaveAttribute('aria-describedby', tooltip.id)
  }

  fireEvent.pointerEnter(point, { pointerType: 'mouse' })
  expectTooltip()
  fireEvent.pointerLeave(chart.parentElement!, { pointerType: 'mouse' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

  fireEvent.focus(point)
  expectTooltip()
  fireEvent.keyDown(point, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

  fireEvent.pointerDown(point, { pointerType: 'touch' })
  expectTooltip()
  fireEvent.pointerDown(
    screen.getByRole('group', { name: 'Quick date ranges' }),
    {
      pointerType: 'touch',
    },
  )
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

it('applies quick ranges, adjustable date endpoints, clipped trend/reference lines, and restores all records', () => {
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
  expect(chart().querySelector('[data-chart-reference]')).toBeInTheDocument()
  expect(chart().querySelector('[data-chart-trend]')).toHaveAttribute(
    'x1',
    '64',
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
    '27.02.2024 – 04.03.2024',
  )
  expect(
    screen.getByRole('slider', { name: 'Visible range start' }),
  ).toHaveAttribute('aria-valuetext', '27.02.2024')

  fireEvent.click(twoWeeks)
  expect(twoWeeks).toHaveAttribute('aria-pressed', 'true')
  expect(oneWeek).toHaveAttribute('aria-pressed', 'false')
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(3)
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    '20.02.2024 – 04.03.2024',
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

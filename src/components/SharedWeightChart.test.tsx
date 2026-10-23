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
    '2026-04-01 – 2026-05-01',
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
  expect(start).toHaveAttribute('aria-valuetext', '2026-01-02')
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(4)
  fireEvent.keyDown(end, { key: 'ArrowLeft' })
  expect(end).toHaveAttribute('aria-valuetext', '2026-04-30')
  expect(screen.getByLabelText('Visible date range')).toHaveTextContent(
    '2026-01-02 – 2026-04-30',
  )
  expect(chart().querySelectorAll('circle[data-date]')).toHaveLength(3)
})

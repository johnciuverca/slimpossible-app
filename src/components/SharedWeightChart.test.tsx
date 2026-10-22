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

it('anchors a one-point member label to the shared chart edge, not its local series start', () => {
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
  expect(label).toHaveAttribute('text-anchor', 'end')
  expect(Number(label?.getAttribute('x'))).toBe(688)
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

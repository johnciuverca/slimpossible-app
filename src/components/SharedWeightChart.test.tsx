import { cleanup, render, screen } from '@testing-library/react'
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

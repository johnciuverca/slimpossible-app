import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PersonalProgressChart } from './PersonalProgressChart'
afterEach(cleanup)
it('keeps derived trend and goal lines separate from exact saved points', () => {
  render(
    <PersonalProgressChart
      weighIns={[
        { date: '2026-10-01', weightKg: 100, participantId: 'own' },
        { date: '2026-10-11', weightKg: 90, participantId: 'own' },
      ]}
      referenceWeightKg={80}
      referenceLabel="Own selected goal"
    />,
  )
  const chart = screen.getByRole('img')
  expect(chart.querySelectorAll('circle[data-date]')).toHaveLength(2)
  expect(chart.querySelector('[data-chart-trend]')).toBeInTheDocument()
  expect(chart.querySelector('[data-chart-reference]')).toBeInTheDocument()
  expect(screen.getByText('Weight (kg)')).toBeInTheDocument()
  expect(chart.querySelector('.chart-legend')).toBeNull()
  expect(chart).toHaveAccessibleDescription(/Own selected goal at 80 kilograms/)
  const labels = Array.from(chart.querySelectorAll('.chart-value'))
  expect(labels.map((label) => label.textContent)).toEqual(['100', '90'])
  expect(labels.map((label) => label.getAttribute('font-size'))).toEqual([
    '6',
    '6',
  ])
  const weights = Array.from(
    chart.querySelectorAll('[data-chart-tick]'),
    (tick) => Number(tick.getAttribute('data-chart-tick')),
  )
  expect(
    weights.every(
      (weight, index) => index === 0 || weight - weights[index - 1] === 0.5,
    ),
  ).toBe(true)
  const dates = Array.from(
    chart.querySelectorAll('[data-chart-date-tick]'),
    (tick) => tick.getAttribute('data-chart-date-tick'),
  )
  expect(dates).toEqual(['2026-10-01', '2026-10-08'])
  expect(
    Array.from(chart.querySelectorAll('[data-chart-date-tick]'), (tick) =>
      tick.getAttribute('font-size'),
    ),
  ).toEqual(['6.5', '6.5'])
  expect(chart).toHaveAttribute('viewBox', '0 0 760 266')
  expect(chart).toHaveClass('block', 'h-auto', 'w-full', 'min-w-[600px]')
  expect(chart.querySelector('path:not([data-chart-trend])')).toHaveAttribute(
    'stroke-width',
    '3',
  )
  expect(chart.querySelector('[data-chart-trend]')).toHaveAttribute(
    'stroke-width',
    '2',
  )
  expect(chart.querySelector('[data-chart-reference]')).toHaveAttribute(
    'stroke-width',
    '2',
  )
  expect(
    Array.from(chart.querySelectorAll('circle[data-date]'), (point) =>
      Number(point.getAttribute('cx')),
    ),
  ).toEqual([64, 696])
  expect(chart.querySelectorAll('circle title')[0]).toHaveTextContent(
    '2026-10-01: 100 kg recorded',
  )
})
it('shows one saved entry without a derived trend or invented target', () => {
  render(
    <PersonalProgressChart
      weighIns={[{ date: '2026-10-01', weightKg: 100, participantId: 'own' }]}
    />,
  )
  expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(1)
  expect(screen.getByRole('img').querySelector('[data-chart-trend]')).toBeNull()
  expect(
    screen.getByRole('img').querySelector('[data-chart-reference]'),
  ).toBeNull()
  expect(screen.getByRole('img').querySelector('.chart-legend')).toBeNull()
})

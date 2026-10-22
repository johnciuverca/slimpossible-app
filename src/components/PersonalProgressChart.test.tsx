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
  expect(
    Array.from(
      chart.querySelectorAll('.chart-value'),
      (label) => label.textContent,
    ),
  ).toEqual(['100', '90'])
  expect(
    Array.from(chart.querySelectorAll('.chart-value'), (label) =>
      label.getAttribute('font-size'),
    ),
  ).toEqual(['5', '5'])
  expect(chart.querySelectorAll('.chart-value')).toHaveLength(2)
  expect(chart.querySelectorAll('.chart-legend')).toHaveLength(0)
  expect(chart).toHaveAccessibleName(/Own selected goal at 80 kilograms/i)
  expect(chart.querySelectorAll('circle title')[0]).toHaveTextContent(
    '2026-10-01: 100 kg recorded',
  )
  expect(chart).toHaveAccessibleDescription(
    /ticks every 1 kilogram.*exact weight/i,
  )
})
it('shows one saved entry without a derived trend or invented target', () => {
  render(
    <PersonalProgressChart
      weighIns={[{ date: '2026-10-01', weightKg: 100, participantId: 'own' }]}
    />,
  )
  const chart = screen.getByRole('img')
  expect(chart.querySelectorAll('circle')).toHaveLength(1)
  expect(chart.querySelectorAll('.chart-value')).toHaveLength(1)
  expect(chart.querySelector('.chart-value')).toHaveTextContent(/^100$/)
  expect(chart.querySelector('.chart-legend')).toBeNull()
  expect(chart.querySelector('[data-chart-trend]')).toBeNull()
  expect(chart.querySelector('[data-chart-reference]')).toBeNull()
})

it('uses all 31 calendar-day positions and plots only actual saved dates', () => {
  const weighIns = [
    { date: '2026-10-01', weightKg: 100, participantId: 'own' },
    { date: '2026-10-08', weightKg: 99, participantId: 'own' },
    { date: '2026-10-19', weightKg: 98, participantId: 'own' },
    { date: '2026-10-31', weightKg: 97, participantId: 'own' },
  ]
  render(<PersonalProgressChart weighIns={weighIns} />)
  const chart = screen.getByRole('img')
  const points = Array.from(chart.querySelectorAll('circle[data-date]'))
  expect(chart).toHaveAttribute('viewBox', '0 0 760 266')
  expect(chart).toHaveAttribute('width', '760')
  expect(chart).toHaveAttribute('height', '266')
  expect(points.map((point) => point.getAttribute('data-date'))).toEqual(
    weighIns.map(({ date }) => date),
  )
  expect(points.map((point) => Number(point.getAttribute('cx')))).toEqual([
    64,
    64 + (7 / 30) * 632,
    64 + (18 / 30) * 632,
    696,
  ])
  expect(
    Array.from(chart.querySelectorAll('[data-chart-date-tick]'), (tick) =>
      tick.getAttribute('data-chart-date-tick'),
    ),
  ).toEqual([
    '2026-10-01',
    '2026-10-08',
    '2026-10-15',
    '2026-10-22',
    '2026-10-29',
  ])
  expect(chart.querySelectorAll('[data-chart-area]')).toHaveLength(1)
})

it('places two saved month-end weigh-ins at opposite ends of the plot', () => {
  render(
    <PersonalProgressChart
      weighIns={[
        { date: '2026-10-01', weightKg: 100, participantId: 'own' },
        { date: '2026-10-31', weightKg: 99, participantId: 'own' },
      ]}
    />,
  )
  const points = Array.from(
    screen.getByRole('img').querySelectorAll('circle[data-date]'),
  )
  expect(points).toHaveLength(2)
  expect(points.map((point) => point.getAttribute('data-date'))).toEqual([
    '2026-10-01',
    '2026-10-31',
  ])
  expect(points.map((point) => Number(point.getAttribute('cx')))).toEqual([
    64, 696,
  ])
})

it('progressively zooms out for history spanning more calendar days', () => {
  const firstMonthEntries = [
    { date: '2026-10-01', weightKg: 100, participantId: 'own' },
    { date: '2026-10-31', weightKg: 99, participantId: 'own' },
  ]
  const longerHistory = [
    ...firstMonthEntries,
    { date: '2026-11-07', weightKg: 98, participantId: 'own' },
    { date: '2026-11-14', weightKg: 97, participantId: 'own' },
    { date: '2026-11-21', weightKg: 96, participantId: 'own' },
  ]
  const { rerender } = render(
    <PersonalProgressChart weighIns={firstMonthEntries} />,
  )
  const firstRangeLastX = Number(
    screen
      .getByRole('img')
      .querySelectorAll('circle[data-date]')[1]
      .getAttribute('cx'),
  )
  rerender(<PersonalProgressChart weighIns={longerHistory} />)
  const chart = screen.getByRole('img')
  const points = Array.from(chart.querySelectorAll('circle[data-date]'))
  const expandedRangeLastX = Number(points[1].getAttribute('cx'))
  expect(expandedRangeLastX).toBeLessThan(firstRangeLastX)
  expect(chart).toHaveAttribute('viewBox', '0 0 760 266')
  expect(chart).toHaveAttribute('width', '760')
  expect(chart).toHaveAttribute('height', '266')
  expect(points).toHaveLength(longerHistory.length)
  const weeklyTicks = Array.from(
    chart.querySelectorAll('[data-chart-date-tick]'),
    (tick) =>
      Date.parse(`${tick.getAttribute('data-chart-date-tick')}T00:00:00Z`),
  )
  expect(
    weeklyTicks.every(
      (tick, index) =>
        index === 0 || tick - weeklyTicks[index - 1] === 7 * 86400000,
    ),
  ).toBe(true)
})

it('labels every dense saved point and keeps one-kilogram axis ticks', () => {
  const weighIns = Array.from({ length: 40 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    weightKg: 100 - index / 10,
    participantId: 'own',
  }))
  render(
    <PersonalProgressChart
      weighIns={weighIns}
      referenceWeightKg={80}
      referenceLabel="Selected target"
    />,
  )
  const chart = screen.getByRole('img')
  const points = Array.from(chart.querySelectorAll('circle[data-date]'))
  expect(points).toHaveLength(40)
  expect(
    points.map((point) => [
      point.getAttribute('data-date'),
      point.getAttribute('data-weight-kg'),
    ]),
  ).toEqual(weighIns.map(({ date, weightKg }) => [date, String(weightKg)]))
  const labels = Array.from(chart.querySelectorAll('.chart-value'))
  expect(labels.map((label) => label.textContent)).toEqual(
    weighIns.map(({ weightKg }) =>
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
        weightKg,
      ),
    ),
  )
  expect(labels.every((label) => label.getAttribute('font-size') === '5')).toBe(
    true,
  )
  expect(
    labels.map((label) => [
      label.getAttribute('data-date'),
      label.getAttribute('data-weight-kg'),
    ]),
  ).toEqual(weighIns.map(({ date, weightKg }) => [date, String(weightKg)]))
  const ticks = Array.from(
    chart.querySelectorAll('[data-chart-tick]'),
    (tick) => Number(tick.getAttribute('data-chart-tick')),
  )
  expect(ticks.length).toBeGreaterThan(1)
  expect(
    ticks.every((tick, index) => index === 0 || tick - ticks[index - 1] === 1),
  ).toBe(true)
  expect(chart).toHaveAccessibleName(/40 saved weigh-ins/)
  expect(chart).toHaveAccessibleDescription(
    /ticks every 1 kilogram.*least-squares fit/i,
  )
  expect(screen.getByText('Weight (kg)')).toBeInTheDocument()
  expect(chart.querySelector('.chart-legend')).toBeNull()
})

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
  expect(screen.getByText('Own selected goal: 80 kg')).toBeInTheDocument()
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
  ).toEqual(['10', '10'])
  expect(chart.querySelectorAll('circle title')[0]).toHaveTextContent(
    '2026-10-01: 100 kg recorded',
  )
  expect(chart).toHaveAccessibleDescription(
    /Recorded points show saved dates and weights/,
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
  expect(chart.querySelector('.chart-value')).toHaveTextContent(/^100$/)
  expect(chart.querySelector('[data-chart-trend]')).toBeNull()
  expect(chart.querySelector('[data-chart-reference]')).toBeNull()
})

it('keeps dense recorded values mapped to their dates while labeling only numeric endpoints', () => {
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
  expect(labels.map((label) => label.textContent)).toEqual(['100', '96.1'])
  expect(
    labels.every((label) => label.getAttribute('font-size') === '10'),
  ).toBe(true)
  expect(chart).toHaveAccessibleName(/40 saved weigh-ins/)
  expect(chart).toHaveAccessibleDescription(/least-squares fit/)
  expect(screen.getByText('Weight (kg)')).toBeInTheDocument()
  expect(screen.getByText('Selected target: 80 kg')).toBeInTheDocument()
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PersonalProgressChart } from './PersonalProgressChart'
import { SharedWeightChart } from './SharedWeightChart'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('keeps an estimate-only selected range safe and labels no estimates as extrema', () => {
  render(
    <PersonalProgressChart
      labelExtremesOnly
      weighIns={[
        { date: '2026-11-01', weightKg: 90, participantId: 'own' },
        { date: '2026-11-11', weightKg: 80, participantId: 'own' },
      ]}
    />,
  )
  const chart = screen.getByRole('img', { name: /Personal weight history/ })
  const start = screen.getByRole('slider', { name: 'Visible range start' })
  const end = screen.getByRole('slider', { name: 'Visible range end' })
  fireEvent.keyDown(start, { key: 'ArrowRight' })
  fireEvent.keyDown(end, { key: 'ArrowLeft' })
  expect(
    chart.querySelectorAll('circle[data-point-kind="estimated"]'),
  ).toHaveLength(9)
  expect(chart.querySelectorAll('.chart-value')).toHaveLength(0)
})

it('fits a Dashboard personal trend inside its card while keeping range controls and exact point details', () => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  const weighIns = [
    '2025-01-01',
    '2025-04-01',
    '2025-07-01',
    '2025-10-01',
    '2026-01-01',
    '2026-04-01',
    '2026-07-01',
    '2026-10-01',
  ].map((date, index) => ({
    date,
    weightKg: 100 - index,
    participantId: 'own',
  }))
  render(
    <PersonalProgressChart
      fitContainer
      labelExtremesOnly
      weighIns={weighIns}
    />,
  )

  const chart = screen.getByRole('img', { name: /Personal weight history/ })
  expect(chart).toHaveAttribute('viewBox', '0 0 320 266')
  expect(chart).toHaveClass('min-w-0')
  expect(chart).not.toHaveClass('min-w-[600px]')
  expect(
    screen.getByRole('group', { name: 'Personal weight chart' }),
  ).toHaveClass('min-w-0')
  expect(
    chart.querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(weighIns.length)
  const extremeLabels = Array.from(
    chart.querySelectorAll<SVGTextElement>('.chart-value'),
  )
  expect(extremeLabels).toHaveLength(2)
  expect(
    extremeLabels.map((label) => Number(label.getAttribute('data-weight-kg'))),
  ).toEqual([100, 93])
  for (const label of extremeLabels) {
    const x = Number(label.getAttribute('x'))
    const halfWidth = (label.textContent!.length * 5.4) / 2
    expect(x - halfWidth).toBeGreaterThanOrEqual(48)
    expect(x + halfWidth).toBeLessThanOrEqual(312)
  }
  const dateTicks = Array.from(
    chart.querySelectorAll('[data-chart-date-tick]'),
    (tick) => tick.getAttribute('data-chart-date-tick'),
  )
  expect(dateTicks.length).toBeLessThanOrEqual(4)
  expect(dateTicks[0]).toBe(weighIns[0].date)
  expect(dateTicks.at(-1)).toBe(weighIns.at(-1)!.date)
  expect(screen.getByRole('group', { name: 'Quick date ranges' })).toBeVisible()
  for (const name of [
    'Show last 1 week',
    'Show last 2 weeks',
    'Show last 1 month',
    'Show last 3 months',
    'Show all dates',
  ])
    expect(screen.getByRole('button', { name })).toBeVisible()
  expect(screen.getAllByRole('slider')).toHaveLength(2)

  const point = chart.querySelector('circle[data-chart-point]')!
  fireEvent.pointerDown(point, { pointerType: 'touch' })
  expect(screen.getByRole('tooltip')).toHaveTextContent(/01\.01\.2025: 100 kg/)
})

it('labels one point per extreme, one point on equal values, and updates extremes with the selected range', () => {
  const tiedWeighIns = [
    { date: '2026-01-01', weightKg: 90, participantId: 'own' },
    { date: '2026-01-08', weightKg: 80, participantId: 'own' },
    { date: '2026-01-15', weightKg: 90, participantId: 'own' },
    { date: '2026-01-22', weightKg: 80, participantId: 'own' },
  ]
  const { rerender } = render(
    <PersonalProgressChart labelExtremesOnly weighIns={tiedWeighIns} />,
  )
  const chart = () =>
    screen.getByRole('img', { name: /Personal weight history/ })
  const labels = () => Array.from(chart().querySelectorAll('.chart-value'))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(4)
  expect(labels().map((label) => label.getAttribute('data-date'))).toEqual([
    '2026-01-01',
    '2026-01-08',
  ])

  rerender(
    <PersonalProgressChart
      labelExtremesOnly
      weighIns={[
        { date: '2026-02-01', weightKg: 88, participantId: 'own' },
        { date: '2026-02-08', weightKg: 88, participantId: 'own' },
        { date: '2026-02-15', weightKg: 88, participantId: 'own' },
      ]}
    />,
  )
  expect(labels()).toHaveLength(1)

  rerender(
    <PersonalProgressChart
      labelExtremesOnly
      weighIns={[{ date: '2026-03-01', weightKg: 88, participantId: 'own' }]}
    />,
  )
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(1)
  expect(labels()).toHaveLength(1)

  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  rerender(
    <PersonalProgressChart
      labelExtremesOnly
      weighIns={[70, 40, 20, 0].map((days, index) => ({
        date: daysAgo(days),
        weightKg: [110, 80, 95, 90][index],
        participantId: 'own',
      }))}
    />,
  )
  expect(labels().map((label) => label.getAttribute('data-weight-kg'))).toEqual(
    ['110', '80'],
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(2)
  expect(labels().map((label) => label.getAttribute('data-weight-kg'))).toEqual(
    ['95', '90'],
  )
  const visiblePoint = chart().querySelector(
    'circle[data-chart-point][data-weight-kg="95"]',
  )!
  fireEvent.pointerDown(visiblePoint, { pointerType: 'touch' })
  expect(screen.getByRole('tooltip')).toHaveTextContent(/95 kg/)
  fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(4)
})
it('keeps derived trend and goal lines separate from exact saved points', () => {
  render(
    <PersonalProgressChart
      weighIns={[
        { date: '2026-10-01', weightKg: 100, participantId: 'own' },
        { date: '2026-10-11', weightKg: 90, participantId: 'own' },
      ]}
      referenceWeightKg={95}
      referenceLabel="Own selected goal"
    />,
  )
  const chart = screen.getByRole('img')
  expect(chart).toHaveAccessibleDescription(/The trend uses only saved records/)
  expect(
    screen.getByText(/saved weigh-ins from 01\.10\.2026 to 11\.10\.2026/),
  ).toHaveClass('sr-only')
  expect(
    chart.querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(2)
  expect(chart.querySelector('[data-chart-trend]')).toBeInTheDocument()
  expect(chart.querySelector('[data-chart-trend]')).toHaveAttribute(
    'opacity',
    '0.35',
  )
  expect(chart.querySelector('[data-chart-reference]')).toBeInTheDocument()
  expect(
    chart.querySelector('[data-chart-line-kind="reference"]'),
  ).toHaveAttribute('stroke-dasharray', '9 5')
  expect(chart.querySelector('[data-chart-line-kind="trend"]')).toHaveAttribute(
    'stroke-dasharray',
    '3 6',
  )
  expect(screen.getByText('Weight (kg)')).toBeInTheDocument()
  expect(chart.querySelector('.chart-legend')).toBeNull()
  expect(chart).toHaveAccessibleDescription(/Own selected goal is 95 kilograms/)
  const labels = Array.from(chart.querySelectorAll('.chart-value'))
  expect(labels.map((label) => label.textContent)).toEqual(['100', '90'])
  expect(labels.map((label) => label.getAttribute('font-size'))).toEqual([
    '6.6',
    '6.6',
  ])
  const weights = Array.from(
    chart.querySelectorAll('[data-chart-tick]'),
    (tick) => Number(tick.getAttribute('data-chart-tick')),
  )
  expect(weights.every((weight) => weight % 5 === 0)).toBe(true)
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
    Array.from(
      chart.querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
      (point) => Number(point.getAttribute('cx')),
    ),
  ).toEqual([64, 696])
  expect(chart.querySelectorAll('circle title')[0]).toHaveTextContent(
    '01.10.2026: 100 kg recorded',
  )
  expect(chart.querySelectorAll('[data-chart-date-tick]')[0]).toHaveTextContent(
    '01.10.2026',
  )
  expect(screen.getByText(/saved weigh-ins from/)).toHaveTextContent(
    '01.10.2026 to 11.10.2026',
  )
  expect(chart.querySelectorAll('[data-chart-date-tick]')).toHaveLength(2)
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

it('uses aligned five-kilogram labels for wide visible spans and finer ticks after narrowing the date range', () => {
  render(
    <PersonalProgressChart
      weighIns={[
        { date: '2026-01-01', weightKg: 80.3, participantId: 'own' },
        { date: '2026-02-01', weightKg: 105.2, participantId: 'own' },
        { date: '2026-02-15', weightKg: 100.1, participantId: 'own' },
        { date: '2026-03-01', weightKg: 101.2, participantId: 'own' },
      ]}
    />,
  )
  const chart = () =>
    screen.getByRole('img', { name: /Personal weight history/ })
  const majorTicks = () =>
    Array.from(chart().querySelectorAll('[data-chart-tick]'), (tick) =>
      Number(tick.getAttribute('data-chart-tick')),
    )
  expect(majorTicks().length).toBeGreaterThan(2)
  expect(majorTicks().every((tick) => tick % 5 === 0)).toBe(true)
  expect(Math.min(...majorTicks())).toBeLessThanOrEqual(80.3)
  expect(Math.max(...majorTicks())).toBeGreaterThanOrEqual(105.2)
  expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(
    majorTicks().length > 2
      ? ((Math.max(...majorTicks()) - Math.min(...majorTicks())) / 5) * 4
      : 0,
  )
  expect(chart().querySelectorAll('.chart-value')).toHaveLength(4)
  expect(chart()).toHaveAttribute('viewBox', '0 0 760 266')

  fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(3)
  const narrowTicks = majorTicks()
  expect(narrowTicks.length).toBeGreaterThan(2)
  expect(narrowTicks.every((tick) => tick % 5 === 0)).toBe(false)
  expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
  expect(majorTicks().every((tick) => tick % 5 === 0)).toBe(true)
})

it('recalculates axis labels when an edited weigh-in widens or narrows the visible span', () => {
  const weighIns = (latestWeightKg: number) => [
    { date: '2026-10-01', weightKg: 89.7, participantId: 'own' },
    { date: '2026-10-15', weightKg: latestWeightKg, participantId: 'own' },
  ]
  const { rerender } = render(
    <PersonalProgressChart weighIns={weighIns(91.2)} />,
  )
  const chart = () =>
    screen.getByRole('img', { name: /Personal weight history/ })
  const majorTicks = () =>
    Array.from(chart().querySelectorAll('[data-chart-tick]'), (tick) =>
      Number(tick.getAttribute('data-chart-tick')),
    )

  expect(majorTicks().some((tick) => tick % 5 !== 0)).toBe(true)
  expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(0)

  rerender(<PersonalProgressChart weighIns={weighIns(99.7)} />)
  const wideMajorTicks = majorTicks()
  expect(wideMajorTicks.every((tick) => tick % 5 === 0)).toBe(true)
  expect(Math.min(...wideMajorTicks)).toBeLessThanOrEqual(89.7)
  expect(Math.max(...wideMajorTicks)).toBeGreaterThanOrEqual(99.7)
  expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(
    ((Math.max(...wideMajorTicks) - Math.min(...wideMajorTicks)) / 5) * 4,
  )

  rerender(<PersonalProgressChart weighIns={weighIns(91.2)} />)
  expect(majorTicks().some((tick) => tick % 5 !== 0)).toBe(true)
  expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(0)
})

it.each([83, 120])(
  'keeps an owner goal at %s kg outside the data-driven axis',
  (referenceWeightKg) => {
    const weighIns = [
      { date: '2026-10-15', weightKg: 99.7, participantId: 'owner' },
    ]
    render(
      <PersonalProgressChart
        weighIns={weighIns}
        referenceWeightKg={referenceWeightKg}
      />,
    )
    const chart = () =>
      screen.getByRole('img', { name: /Personal weight history/ })
    const majorTicks = () =>
      Array.from(chart().querySelectorAll('[data-chart-tick]'), (tick) =>
        Number(tick.getAttribute('data-chart-tick')),
      )

    expect(majorTicks().some((tick) => tick % 5 !== 0)).toBe(true)
    expect(Math.min(...majorTicks())).toBeGreaterThanOrEqual(99)
    expect(Math.max(...majorTicks())).toBeLessThanOrEqual(100.5)
    expect(chart().querySelectorAll('[data-chart-minor-tick]')).toHaveLength(0)
    expect(chart().querySelector('[data-chart-reference]')).toBeNull()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  },
)

it('keeps five-kilogram ticks aligned around low and negative generic ranges', () => {
  render(
    <SharedWeightChart
      title="Low weight range"
      description="Test range."
      yLabel="Weight (kg)"
      min={-14}
      max={-1}
      adaptiveWeightTicks
      points={[
        { date: '2026-10-01', value: -12.5, title: 'Low' },
        { date: '2026-10-08', value: -2.2, title: 'High' },
      ]}
    />,
  )
  const ticks = Array.from(
    screen
      .getByRole('img', { name: 'Low weight range' })
      .querySelectorAll('[data-chart-tick]'),
    (tick) => Number(tick.getAttribute('data-chart-tick')),
  )
  expect(ticks.every((tick) => tick % 5 === 0)).toBe(true)
  expect(Math.min(...ticks)).toBeLessThanOrEqual(-12.5)
  expect(Math.max(...ticks)).toBeGreaterThanOrEqual(-2.2)
})

it('labels every saved weigh-in with only its numeric value', () => {
  const weighIns = [
    { date: '2026-10-01', weightKg: 90, participantId: 'own' },
    { date: '2026-10-08', weightKg: 89.5, participantId: 'own' },
    { date: '2026-10-15', weightKg: 88.5, participantId: 'own' },
    { date: '2026-10-22', weightKg: 87, participantId: 'own' },
  ]
  render(<PersonalProgressChart weighIns={weighIns} />)
  const chart = screen.getByRole('img')
  const points = Array.from(
    chart.querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  )
  const labels = Array.from(chart.querySelectorAll('.chart-value'))
  expect(points).toHaveLength(weighIns.length)
  expect(labels).toHaveLength(points.length)
  expect(
    labels.map((label) => [
      label.getAttribute('data-date'),
      label.getAttribute('data-weight-kg'),
      label.textContent,
      label.getAttribute('font-size'),
    ]),
  ).toEqual([
    ['2026-10-01', '90', '90', '6.6'],
    ['2026-10-08', '89.5', '89.5', '6.6'],
    ['2026-10-15', '88.5', '88.5', '6.6'],
    ['2026-10-22', '87', '87', '6.6'],
  ])
})

it('changes the personal chart window without changing saved weigh-ins', () => {
  const weighIns = [
    '2026-01-01',
    '2026-02-01',
    '2026-03-01',
    '2026-04-01',
    '2026-05-01',
  ].map((date, index) => ({
    date,
    weightKg: 90 - index,
    participantId: 'own',
  }))
  render(<PersonalProgressChart weighIns={weighIns} />)
  const chart = () =>
    screen.getByRole('img', { name: /Personal weight history chart/ })
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: 'Show last 1 month' }))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(2)
  expect(
    chart().querySelectorAll('[data-chart-date-tick]').length,
  ).toBeLessThan(18)
  const rangeTrack = screen.getByRole('group', {
    name: 'Adjust visible date range',
  })
  expect(rangeTrack.querySelectorAll('[role="slider"]')).toHaveLength(2)
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Visible range end' }), {
    key: 'ArrowLeft',
  })
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(1)
  expect(weighIns).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: 'Show all dates' }))
  expect(
    chart().querySelectorAll('circle[data-point-kind="recorded"][data-date]'),
  ).toHaveLength(5)
})

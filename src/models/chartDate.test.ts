import { expect, it } from 'vitest'
import { formatChartDate } from './chartDate'

it.each([
  ['2026-01-09', '09.01.2026'],
  ['2026-12-31', '31.12.2026'],
  ['2027-01-01', '01.01.2027'],
])('formats %s as %s without changing its calendar date', (iso, display) => {
  expect(formatChartDate(iso)).toBe(display)
})

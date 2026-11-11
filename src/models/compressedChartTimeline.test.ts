import { expect, it } from 'vitest'
import {
  chartDay,
  compressedChartSlots,
  slotIndex,
} from './compressedChartTimeline'
import { compactWeeklyHistory } from './weeklyChartHistory'

it('assigns one common slot per older week and seven recent daily slots including partial boundary week', () => {
  const slots = compressedChartSlots(
    chartDay('2026-10-19'),
    chartDay('2026-11-10'),
    chartDay('2026-11-10'),
    new Set(),
  )
  expect(slots).toHaveLength(10)
  expect(slots.filter((slot) => slot.weekly)).toHaveLength(3)
  expect(slots[2]).toEqual({
    start: chartDay('2026-11-02'),
    end: chartDay('2026-11-03'),
    weekly: true,
  })
  expect(slotIndex(slots, chartDay('2026-10-19'))).toBe(
    slotIndex(slots, chartDay('2026-10-25')),
  )
  expect(
    slotIndex(slots, chartDay('2026-10-26')) -
      slotIndex(slots, chartDay('2026-10-19')),
  ).toBe(1)
  expect(
    slotIndex(slots, chartDay('2026-11-05')) -
      slotIndex(slots, chartDay('2026-11-04')),
  ).toBe(1)
})

it('expands one weekly slot into aligned daily slots for unequal member histories', () => {
  const expanded = new Set(['a:2026-10-26'])
  const slots = compressedChartSlots(
    chartDay('2026-10-19'),
    chartDay('2026-11-10'),
    chartDay('2026-11-10'),
    expanded,
  )
  expect(slots).toHaveLength(16)
  expect(
    slotIndex(slots, chartDay('2026-10-27')) -
      slotIndex(slots, chartDay('2026-10-26')),
  ).toBe(1)
  const members = ['a', 'b'].map((id) => ({
    id,
    color: 'green',
    points: [
      { date: id === 'a' ? '2026-10-26' : '2026-10-28', value: 80, title: id },
      { date: '2026-11-10', value: 79, title: id },
    ],
  }))
  expect(
    compactWeeklyHistory(members, expanded).every((member) =>
      member.points.every((point) => !point.weeklySummary),
    ),
  ).toBe(true)
})

it('retains empty calendar buckets without values and uses date-only math across year and DST boundaries', () => {
  for (const [first, last] of [
    ['2025-12-22', '2026-01-12'],
    ['2026-03-16', '2026-04-06'],
  ]) {
    const slots = compressedChartSlots(
      chartDay(first),
      chartDay(last),
      chartDay(last),
      new Set(),
    )
    expect(slots.filter((slot) => !slot.weekly)).toHaveLength(7)
    for (let index = 1; index < slots.length; index++)
      expect(slots[index].start).toBe(slots[index - 1].end + 1)
  }
})

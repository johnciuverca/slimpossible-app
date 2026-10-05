import { describe, expect, it } from 'vitest'

import { calculatePersonalWeeklyChange } from './personalWeeklyChange'
import type { WeighIn } from './weighIn'

const participantId = 'participant-1'

describe('calculatePersonalWeeklyChange', () => {
  it.each([
    [92.5, -0.7, 'loss'],
    [94, 0.8, 'gain'],
    [93.2, 0, 'maintenance'],
  ])('compares actual saved entries for a %s week', (previous, change) => {
    const weighIns: WeighIn[] = [
      { date: '2026-09-28', participantId, weightKg: previous + change },
      { date: '2026-09-27', participantId, weightKg: previous },
      { date: '2026-09-30', participantId: 'another-participant', weightKg: 1 },
    ]

    expect(
      calculatePersonalWeeklyChange(weighIns, participantId, '2026-10-01'),
    ).toMatchObject({
      changeKg: change,
      currentWeighIn: { date: '2026-09-28', weightKg: previous + change },
      previousWeighIn: { date: '2026-09-27', weightKg: previous },
      state: 'ready',
    })
  })

  it('uses the latest saved entry in each week after late entries or corrections', () => {
    const weighIns: WeighIn[] = [
      { date: '2026-09-22', participantId, weightKg: 90 },
      { date: '2026-09-27', participantId, weightKg: 89.5 },
      { date: '2026-09-29', participantId, weightKg: 89.1 },
      {
        date: '2026-09-29',
        participantId: 'another-participant',
        weightKg: 70,
      },
    ]

    expect(
      calculatePersonalWeeklyChange(weighIns, participantId, '2026-10-01'),
    ).toMatchObject({
      changeKg: -0.4,
      currentWeighIn: { date: '2026-09-29', weightKg: 89.1 },
      previousWeighIn: { date: '2026-09-27', weightKg: 89.5 },
      state: 'ready',
    })
  })

  it('does not invent a current-week or comparison value when records are missing', () => {
    expect(
      calculatePersonalWeeklyChange([], participantId, '2026-10-01'),
    ).toMatchObject({
      changeKg: null,
      currentWeighIn: null,
      previousWeighIn: null,
      state: 'no-current-week-record',
    })
    expect(
      calculatePersonalWeeklyChange(
        [{ date: '2026-09-29', participantId, weightKg: 89.1 }],
        participantId,
        '2026-10-01',
      ),
    ).toMatchObject({
      changeKg: null,
      currentWeighIn: { date: '2026-09-29' },
      previousWeighIn: null,
      state: 'no-previous-week-record',
    })
  })
})

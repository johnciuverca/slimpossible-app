import { describe, expect, it } from 'vitest'

import {
  calculateDailyWeightChange,
  calculateTotalWeightChange,
} from './weightChange'
import type { WeighIn } from './weighIn'

const participantId = 'participant-1'

const weighIns: WeighIn[] = [
  { date: '2026-09-13', participantId, weightKg: 92.5 },
  { date: '2026-09-15', participantId, weightKg: 91.8 },
  { date: '2026-09-15', participantId: 'participant-2', weightKg: 75 },
]

describe('calculateDailyWeightChange', () => {
  it('returns a negative change for weight loss', () => {
    expect(
      calculateDailyWeightChange(weighIns, participantId, '2026-09-15'),
    ).toBeCloseTo(-0.7)
  })

  it('returns a positive change for weight gain', () => {
    const gain = [
      { date: '2026-09-14', participantId, weightKg: 80 },
      { date: '2026-09-15', participantId, weightKg: 80.4 },
    ]

    expect(
      calculateDailyWeightChange(gain, participantId, '2026-09-15'),
    ).toBeCloseTo(0.4)
  })

  it('returns null for a first record or a missing date', () => {
    const firstRecord = [weighIns[0]]

    expect(
      calculateDailyWeightChange(firstRecord, participantId, '2026-09-13'),
    ).toBeNull()
    expect(
      calculateDailyWeightChange(weighIns, participantId, '2026-09-14'),
    ).toBeNull()
  })
})

describe('calculateTotalWeightChange', () => {
  it('calculates change from starting weight to the latest record', () => {
    expect(
      calculateTotalWeightChange(92.5, weighIns, participantId),
    ).toBeCloseTo(-0.7)
  })

  it('uses the latest real record before a gap without inventing one', () => {
    expect(
      calculateTotalWeightChange(92.5, weighIns, participantId, '2026-09-14'),
    ).toBeCloseTo(0)
    expect(
      calculateTotalWeightChange(92.5, weighIns, participantId, '2026-09-12'),
    ).toBeNull()
  })

  it('returns null when no record exists or the starting weight is invalid', () => {
    expect(calculateTotalWeightChange(92.5, [], participantId)).toBeNull()
    expect(calculateTotalWeightChange(0, weighIns, participantId)).toBeNull()
  })
})

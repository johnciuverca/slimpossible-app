import { describe, expect, it } from 'vitest'

import { createParticipantFixture } from './fixtures'
import {
  findWeighInForDate,
  getWeightChangeForDate,
  validateWeighIn,
  type WeighIn,
} from './weighIn'

const participant = createParticipantFixture()
const validWeighIn: WeighIn = {
  date: '2026-09-15',
  id: 'weigh-in-1',
  note: 'Morning reading.',
  participantId: participant.id,
  weightKg: 91.8,
}

describe('validateWeighIn', () => {
  it('accepts a dated weight and optional note', () => {
    expect(validateWeighIn(validWeighIn, { today: '2026-09-15' })).toEqual({
      data: validWeighIn,
      success: true,
    })
  })

  it('rejects future dates, invalid weights, and malformed notes', () => {
    const result = validateWeighIn(
      {
        ...validWeighIn,
        date: '2026-09-16',
        note: 42,
        weightKg: Number.NaN,
      },
      { today: '2026-09-15' },
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'date' }),
          expect.objectContaining({ field: 'note' }),
          expect.objectContaining({ field: 'weightKg' }),
        ]),
      )
    }
  })

  it('requires identity and a real calendar date', () => {
    const result = validateWeighIn(
      {
        ...validWeighIn,
        date: '2026-02-30',
        id: '',
        participantId: '',
      },
      { today: '2026-09-15' },
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.map(({ field }) => field)).toEqual([
        'id',
        'participantId',
        'date',
      ])
    }
  })
})

describe('weigh-in collection helpers', () => {
  it('finds one entry for a participant and date for duplicate checks', () => {
    const weighIns = [validWeighIn]

    expect(findWeighInForDate(weighIns, participant.id, '2026-09-15')).toEqual(
      validWeighIn,
    )
    expect(
      findWeighInForDate(weighIns, participant.id, '2026-09-14'),
    ).toBeUndefined()
    expect(
      findWeighInForDate(
        weighIns,
        participant.id,
        '2026-09-15',
        validWeighIn.id,
      ),
    ).toBeUndefined()
  })

  it('returns no change when today or a previous day is missing', () => {
    expect(getWeightChangeForDate([], participant.id, '2026-09-15')).toBeNull()
    expect(
      getWeightChangeForDate([validWeighIn], participant.id, '2026-09-15'),
    ).toBeNull()
  })

  it('compares with the latest earlier entry for the same participant', () => {
    const weighIns: WeighIn[] = [
      { ...validWeighIn, date: '2026-09-13', id: 'weigh-in-1', weightKg: 92.5 },
      { ...validWeighIn, date: '2026-09-14', id: 'weigh-in-2', weightKg: 92 },
      { ...validWeighIn, date: '2026-09-15', id: 'weigh-in-3', weightKg: 91.8 },
    ]

    expect(
      getWeightChangeForDate(weighIns, participant.id, '2026-09-15'),
    ).toBeCloseTo(-0.2)
  })
})

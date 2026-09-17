import { describe, expect, it } from 'vitest'

import { validateWeighIn, type WeighIn } from './weighIn'

const validWeighIn: WeighIn = {
  date: '2026-09-15',
  note: 'Morning reading.',
  participantId: 'participant-1',
  weightKg: 91.8,
}

const validationToday = '2026-09-15'

describe('validateWeighIn', () => {
  it('accepts a valid record with an optional note', () => {
    expect(validateWeighIn(validWeighIn, { today: validationToday })).toEqual({
      data: validWeighIn,
      success: true,
    })
  })

  it('accepts a valid record when the optional note is omitted', () => {
    const withoutNote: WeighIn = { ...validWeighIn }
    delete withoutNote.note

    expect(validateWeighIn(withoutNote, { today: validationToday })).toEqual({
      data: withoutNote,
      success: true,
    })
  })

  it('rejects missing participant identifiers and dates', () => {
    const result = validateWeighIn(
      {
        ...validWeighIn,
        date: undefined,
        participantId: '   ',
      },
      { today: validationToday },
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'participantId' }),
          expect.objectContaining({ field: 'date' }),
        ]),
      )
    }
  })

  it('rejects invalid calendar dates and future dates', () => {
    const invalidDateResult = validateWeighIn(
      { ...validWeighIn, date: '2026-02-30' },
      { today: validationToday },
    )
    const futureDateResult = validateWeighIn(
      { ...validWeighIn, date: '2026-09-16' },
      { today: validationToday },
    )

    expect(invalidDateResult).toMatchObject({
      issues: [
        expect.objectContaining({
          field: 'date',
          message: 'Date must be a valid YYYY-MM-DD date.',
        }),
      ],
      success: false,
    })
    expect(futureDateResult).toMatchObject({
      issues: [
        expect.objectContaining({
          field: 'date',
          message: 'Weigh-in date cannot be in the future.',
        }),
      ],
      success: false,
    })
  })

  it('rejects zero, negative, non-finite, and malformed note values', () => {
    const invalidValues = [0, -1, Number.NaN, Number.POSITIVE_INFINITY]

    invalidValues.forEach((weightKg) => {
      const result = validateWeighIn(
        { ...validWeighIn, note: 42, weightKg },
        { today: validationToday },
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'weightKg' }),
            expect.objectContaining({ field: 'note' }),
          ]),
        )
      }
    })
  })
})

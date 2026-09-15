import { describe, expect, it } from 'vitest'

import { findWeighInForDate, upsertWeighIn } from './weighInStore'
import type { WeighIn } from './weighIn'

const today = '2026-09-15'
const participantOne = 'participant-1'
const participantTwo = 'participant-2'

const firstWeighIn: WeighIn = {
  date: today,
  note: 'First reading.',
  participantId: participantOne,
  weightKg: 91.8,
}

describe('upsertWeighIn', () => {
  it('creates a valid weigh-in in a new state array', () => {
    const initialState: WeighIn[] = []
    const result = upsertWeighIn(initialState, firstWeighIn, { today })

    expect(result).toEqual({
      data: [firstWeighIn],
      operation: 'created',
      success: true,
    })
    expect(initialState).toEqual([])
  })

  it('updates the matching participant/date instead of creating a duplicate', () => {
    const initialState: WeighIn[] = [firstWeighIn]
    const updatedWeighIn = {
      ...firstWeighIn,
      note: 'Corrected reading.',
      weightKg: 91.5,
    }

    const result = upsertWeighIn(initialState, updatedWeighIn, { today })

    expect(result).toEqual({
      data: [updatedWeighIn],
      operation: 'updated',
      success: true,
    })
    expect(initialState).toEqual([firstWeighIn])
  })

  it('preserves independent participant and date records', () => {
    const otherParticipant: WeighIn = {
      ...firstWeighIn,
      participantId: participantTwo,
    }
    const otherDate: WeighIn = {
      ...firstWeighIn,
      date: '2026-09-14',
    }

    const withOtherParticipant = upsertWeighIn(
      [firstWeighIn],
      otherParticipant,
      { today },
    )
    expect(withOtherParticipant.success).toBe(true)
    if (!withOtherParticipant.success) return

    const result = upsertWeighIn(withOtherParticipant.data, otherDate, {
      today,
    })

    expect(result).toEqual({
      data: [firstWeighIn, otherParticipant, otherDate],
      operation: 'created',
      success: true,
    })
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(findWeighInForDate(result.data, participantOne, today)).toEqual(
      firstWeighIn,
    )
    expect(findWeighInForDate(result.data, participantTwo, today)).toEqual(
      otherParticipant,
    )
  })

  it('does not add invalid input to state', () => {
    const result = upsertWeighIn(
      [firstWeighIn],
      { ...firstWeighIn, weightKg: 0 },
      { today },
    )

    expect(result).toMatchObject({
      issues: [expect.objectContaining({ field: 'weightKg' })],
      success: false,
    })
  })
})

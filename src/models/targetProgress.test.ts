import { describe, expect, it } from 'vitest'

import {
  calculateCompletionPercentage,
  calculateRemainingTargetWeight,
  calculateTargetProgress,
} from './targetProgress'

describe('calculateTargetProgress', () => {
  it('calculates remaining distance and completion for a loss goal', () => {
    const input = {
      currentWeightKg: 90,
      startingWeightKg: 100,
      targetWeightKg: 80,
    }

    expect(calculateTargetProgress(input)).toEqual({
      completionPercentage: 50,
      direction: 'loss',
      remainingKg: 10,
      state: 'target-set',
    })
    expect(calculateRemainingTargetWeight(input)).toBe(10)
    expect(calculateCompletionPercentage(input)).toBe(50)
  })

  it('calculates remaining distance and completion for a gain goal', () => {
    expect(
      calculateTargetProgress({
        currentWeightKg: 90,
        startingWeightKg: 80,
        targetWeightKg: 100,
      }),
    ).toEqual({
      completionPercentage: 50,
      direction: 'gain',
      remainingKg: 10,
      state: 'target-set',
    })
  })

  it('returns an explicit safe state with no configured target', () => {
    const input = {
      currentWeightKg: 90,
      startingWeightKg: 100,
    }

    expect(calculateTargetProgress(input)).toEqual({
      completionPercentage: null,
      direction: null,
      remainingKg: null,
      state: 'no-target',
    })
    expect(calculateRemainingTargetWeight(input)).toBeNull()
    expect(calculateCompletionPercentage(input)).toBeNull()
  })

  it('bounds completion at zero before progress and one hundred after overshoot', () => {
    expect(
      calculateTargetProgress({
        currentWeightKg: 105,
        startingWeightKg: 100,
        targetWeightKg: 80,
      }),
    ).toMatchObject({
      completionPercentage: 0,
      direction: 'loss',
      remainingKg: 25,
    })
    expect(
      calculateTargetProgress({
        currentWeightKg: 75,
        startingWeightKg: 100,
        targetWeightKg: 80,
      }),
    ).toMatchObject({
      completionPercentage: 100,
      direction: 'loss',
      remainingKg: 0,
    })
    expect(
      calculateTargetProgress({
        currentWeightKg: 105,
        startingWeightKg: 80,
        targetWeightKg: 100,
      }),
    ).toMatchObject({
      completionPercentage: 100,
      direction: 'gain',
      remainingKg: 0,
    })
  })

  it('handles a maintain boundary without dividing by zero', () => {
    expect(
      calculateTargetProgress({
        currentWeightKg: 80,
        startingWeightKg: 80,
        targetWeightKg: 80,
      }),
    ).toEqual({
      completionPercentage: 100,
      direction: 'maintain',
      remainingKg: 0,
      state: 'target-set',
    })
  })
})

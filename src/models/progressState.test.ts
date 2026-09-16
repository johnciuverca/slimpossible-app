import { describe, expect, it } from 'vitest'

import { determineProgressState, isTargetReached } from './progressState'

describe('determineProgressState', () => {
  it('returns an explicit no-target state', () => {
    const input = {
      currentWeightKg: 90,
      startingWeightKg: 100,
    }

    expect(determineProgressState(input)).toEqual({
      direction: null,
      state: 'no-target',
    })
    expect(isTargetReached(input)).toBe(false)
  })

  it('distinguishes in-progress and reached loss goals at the boundary', () => {
    const inProgress = {
      currentWeightKg: 81,
      startingWeightKg: 100,
      targetWeightKg: 80,
    }
    const atTarget = { ...inProgress, currentWeightKg: 80 }

    expect(determineProgressState(inProgress)).toEqual({
      direction: 'loss',
      state: 'in-progress',
    })
    expect(determineProgressState(atTarget)).toEqual({
      direction: 'loss',
      state: 'target-reached',
    })
    expect(isTargetReached(atTarget)).toBe(true)
  })

  it('treats gain-target boundaries and overshoot as reached', () => {
    const boundary = {
      currentWeightKg: 100,
      startingWeightKg: 80,
      targetWeightKg: 100,
    }
    const overshoot = { ...boundary, currentWeightKg: 102 }

    expect(determineProgressState(boundary)).toEqual({
      direction: 'gain',
      state: 'target-reached',
    })
    expect(determineProgressState(overshoot)).toEqual({
      direction: 'gain',
      state: 'target-reached',
    })
  })

  it('treats loss-target overshoot as reached without another state', () => {
    expect(
      determineProgressState({
        currentWeightKg: 78,
        startingWeightKg: 100,
        targetWeightKg: 80,
      }),
    ).toEqual({
      direction: 'loss',
      state: 'target-reached',
    })
  })

  it('handles maintain boundaries without contradiction', () => {
    expect(
      determineProgressState({
        currentWeightKg: 80,
        startingWeightKg: 80,
        targetWeightKg: 80,
      }),
    ).toEqual({
      direction: 'maintain',
      state: 'target-reached',
    })
    expect(
      determineProgressState({
        currentWeightKg: 81,
        startingWeightKg: 80,
        targetWeightKg: 80,
      }),
    ).toEqual({
      direction: 'maintain',
      state: 'in-progress',
    })
  })
})

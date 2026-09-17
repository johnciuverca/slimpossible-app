import { describe, expect, it } from 'vitest'

import { determineProgressState } from './progressState'
import {
  gainTarget,
  gainWeighIns,
  missingDayDate,
  noTargetProgress,
  normalLossTarget,
  normalLossWeighIns,
  progressParticipantId,
  reachedGainOvershootTarget,
  reachedLossTarget,
} from './progressFixtures'
import {
  calculateCompletionPercentage,
  calculateRemainingTargetWeight,
  calculateTargetProgress,
} from './targetProgress'
import {
  calculateDailyWeightChange,
  calculateTotalWeightChange,
} from './weightChange'

describe('Chapter 6 progress fixtures', () => {
  it('captures normal loss calculations and an in-progress target', () => {
    expect(
      calculateDailyWeightChange(
        normalLossWeighIns,
        progressParticipantId,
        '2026-09-15',
      ),
    ).toBe(-5)
    expect(
      calculateTotalWeightChange(
        100,
        normalLossWeighIns,
        progressParticipantId,
      ),
    ).toBe(-5)
    expect(calculateRemainingTargetWeight(normalLossTarget)).toBe(15)
    expect(calculateCompletionPercentage(normalLossTarget)).toBe(25)
    expect(determineProgressState(normalLossTarget)).toEqual({
      direction: 'loss',
      state: 'in-progress',
    })
  })

  it('captures gain-direction changes, progress, and state', () => {
    expect(
      calculateDailyWeightChange(
        gainWeighIns,
        progressParticipantId,
        '2026-09-15',
      ),
    ).toBe(5)
    expect(
      calculateTotalWeightChange(70, gainWeighIns, progressParticipantId),
    ).toBe(5)
    expect(calculateRemainingTargetWeight(gainTarget)).toBe(5)
    expect(calculateCompletionPercentage(gainTarget)).toBe(50)
    expect(determineProgressState(gainTarget)).toEqual({
      direction: 'gain',
      state: 'in-progress',
    })
  })

  it('keeps a missing calendar day absent without inventing a change', () => {
    expect(
      calculateDailyWeightChange(
        normalLossWeighIns,
        progressParticipantId,
        missingDayDate,
      ),
    ).toBeNull()
    expect(
      calculateTotalWeightChange(
        100,
        normalLossWeighIns,
        progressParticipantId,
        missingDayDate,
      ),
    ).toBe(0)
    expect(normalLossWeighIns.some(({ date }) => date === missingDayDate)).toBe(
      false,
    )
  })

  it('keeps no-target calculations explicit and safe', () => {
    expect(calculateTargetProgress(noTargetProgress)).toEqual({
      completionPercentage: null,
      direction: null,
      remainingKg: null,
      state: 'no-target',
    })
    expect(determineProgressState(noTargetProgress)).toEqual({
      direction: null,
      state: 'no-target',
    })
  })

  it('protects reached boundaries and overshoot semantics', () => {
    expect(calculateTargetProgress(reachedLossTarget)).toMatchObject({
      completionPercentage: 100,
      direction: 'loss',
      remainingKg: 0,
    })
    expect(determineProgressState(reachedLossTarget)).toEqual({
      direction: 'loss',
      state: 'target-reached',
    })
    expect(calculateTargetProgress(reachedGainOvershootTarget)).toMatchObject({
      completionPercentage: 100,
      direction: 'gain',
      remainingKg: 0,
    })
    expect(determineProgressState(reachedGainOvershootTarget)).toEqual({
      direction: 'gain',
      state: 'target-reached',
    })
  })
})

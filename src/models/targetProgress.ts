export type GoalDirection = 'gain' | 'loss' | 'maintain'

export type TargetProgressInput = {
  currentWeightKg: number
  startingWeightKg: number
  targetWeightKg?: number
}

export type TargetProgress =
  | {
      completionPercentage: null
      direction: null
      remainingKg: null
      state: 'no-target'
    }
  | {
      completionPercentage: number
      direction: GoalDirection
      remainingKg: number
      state: 'target-set'
    }

function isPositiveFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function calculateTargetProgress({
  currentWeightKg,
  startingWeightKg,
  targetWeightKg,
}: TargetProgressInput): TargetProgress {
  if (
    !isPositiveFiniteNumber(startingWeightKg) ||
    !isPositiveFiniteNumber(currentWeightKg) ||
    !isPositiveFiniteNumber(targetWeightKg)
  ) {
    return {
      completionPercentage: null,
      direction: null,
      remainingKg: null,
      state: 'no-target',
    }
  }

  if (targetWeightKg < startingWeightKg) {
    return {
      completionPercentage: clampPercentage(
        ((startingWeightKg - currentWeightKg) /
          (startingWeightKg - targetWeightKg)) *
          100,
      ),
      direction: 'loss',
      remainingKg: Math.max(0, currentWeightKg - targetWeightKg),
      state: 'target-set',
    }
  }

  if (targetWeightKg > startingWeightKg) {
    return {
      completionPercentage: clampPercentage(
        ((currentWeightKg - startingWeightKg) /
          (targetWeightKg - startingWeightKg)) *
          100,
      ),
      direction: 'gain',
      remainingKg: Math.max(0, targetWeightKg - currentWeightKg),
      state: 'target-set',
    }
  }

  const remainingKg = Math.abs(currentWeightKg - targetWeightKg)

  return {
    completionPercentage: remainingKg === 0 ? 100 : 0,
    direction: 'maintain',
    remainingKg,
    state: 'target-set',
  }
}

export function calculateRemainingTargetWeight(input: TargetProgressInput) {
  return calculateTargetProgress(input).remainingKg
}

export function calculateCompletionPercentage(input: TargetProgressInput) {
  return calculateTargetProgress(input).completionPercentage
}

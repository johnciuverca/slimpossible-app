import {
  calculateTargetProgress,
  type GoalDirection,
  type TargetProgressInput,
} from './targetProgress'

export type ProgressState =
  | { direction: null; state: 'no-target' }
  | {
      direction: GoalDirection
      state: 'in-progress' | 'target-reached'
    }

export function determineProgressState(
  input: TargetProgressInput,
): ProgressState {
  const progress = calculateTargetProgress(input)

  if (progress.state === 'no-target') {
    return { direction: null, state: 'no-target' }
  }

  return {
    direction: progress.direction,
    state: progress.remainingKg === 0 ? 'target-reached' : 'in-progress',
  }
}

export function isTargetReached(input: TargetProgressInput) {
  return determineProgressState(input).state === 'target-reached'
}

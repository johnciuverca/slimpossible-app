import type { GoalDirection } from './targetProgress'
import type { ParticipantDashboardView } from './participantDashboard'

export type ParticipantProgressSummaryState =
  | 'participant-not-found'
  | 'first-record'
  | 'no-target'
  | 'in-progress'
  | 'target-reached'

export type ParticipantProgressSummary = {
  completionPercentage: number | null
  currentWeightKg: number | null
  direction: GoalDirection | null
  goalLabel: string | null
  message: string
  remainingTargetWeightKg: number | null
  startingWeightKg: number | null
  state: ParticipantProgressSummaryState
  statusLabel: string
  targetWeightKg: number | null
  totalChangeKg: number | null
}

function goalLabel(direction: GoalDirection) {
  if (direction === 'loss') return 'Weight loss goal'
  if (direction === 'gain') return 'Weight gain goal'
  return 'Maintain weight goal'
}

function inProgressMessage(direction: GoalDirection, remainingKg: number) {
  if (direction === 'maintain') {
    return `You are ${remainingKg} kg away from maintaining your target weight.`
  }

  return `You are ${remainingKg} kg away from your target weight.`
}

export function createParticipantProgressSummary(
  dashboard: ParticipantDashboardView,
): ParticipantProgressSummary {
  const base = {
    completionPercentage: dashboard.completionPercentage,
    currentWeightKg: dashboard.currentWeightKg,
    remainingTargetWeightKg: dashboard.remainingTargetWeightKg,
    startingWeightKg: dashboard.startingWeightKg,
    targetWeightKg: dashboard.targetWeightKg,
    totalChangeKg: dashboard.totalChangeKg,
  }

  if (dashboard.state === 'participant-not-found') {
    return {
      ...base,
      direction: null,
      goalLabel: null,
      message: 'We could not find this participant in the selected challenge.',
      state: 'participant-not-found',
      statusLabel: 'Participant not found',
    }
  }

  if (dashboard.state === 'no-records') {
    return {
      ...base,
      direction: null,
      goalLabel: null,
      message: 'Record your first weigh-in to see progress toward your target.',
      state: 'first-record',
      statusLabel: 'First weigh-in needed',
    }
  }

  if (dashboard.progressState.state === 'no-target') {
    return {
      ...base,
      direction: null,
      goalLabel: null,
      message: 'Add a target weight to see your progress.',
      state: 'no-target',
      statusLabel: 'No target set',
    }
  }

  const { direction } = dashboard.progressState

  if (dashboard.progressState.state === 'target-reached') {
    return {
      ...base,
      direction,
      goalLabel: goalLabel(direction),
      message: 'You have reached your target weight.',
      state: 'target-reached',
      statusLabel: 'Target reached',
    }
  }

  return {
    ...base,
    direction,
    goalLabel: goalLabel(direction),
    message: inProgressMessage(direction, dashboard.remainingTargetWeightKg!),
    state: 'in-progress',
    statusLabel: 'In progress',
  }
}

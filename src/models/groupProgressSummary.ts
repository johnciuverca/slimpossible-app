import type { GroupDashboardAggregation } from './groupDashboardAggregation'

export type GroupProgressSummaryState =
  'empty' | 'no-records' | 'completion-unavailable' | 'ready'

export type GroupProgressSummary = {
  activeParticipantCount: number
  averageCompletionPercentage: number | null
  message: string
  participantsWithProgressCount: number
  participantsWithRecordedWeightCount: number
  reachedTargetCount: number
  state: GroupProgressSummaryState
  statusLabel: string
}

export function createGroupProgressSummary(
  aggregation: GroupDashboardAggregation,
): GroupProgressSummary {
  const base = {
    activeParticipantCount: aggregation.activeParticipantCount,
    averageCompletionPercentage: aggregation.averageCompletionPercentage,
    participantsWithProgressCount: aggregation.participantsWithProgressCount,
    participantsWithRecordedWeightCount:
      aggregation.participantsWithRecordedWeightCount,
    reachedTargetCount: aggregation.reachedTargetCount,
  }

  if (aggregation.state === 'empty') {
    return {
      ...base,
      message: 'There are no active participants in this challenge yet.',
      state: 'empty',
      statusLabel: 'No active participants',
    }
  }

  if (aggregation.state === 'no-records') {
    return {
      ...base,
      message: 'No active participants have recorded a weight yet.',
      state: 'no-records',
      statusLabel: 'No recorded weights',
    }
  }

  if (aggregation.completionState === 'unavailable') {
    return {
      ...base,
      message:
        'Recorded weights are available, but target-based group progress is not available yet.',
      state: 'completion-unavailable',
      statusLabel: 'Group progress unavailable',
    }
  }

  return {
    ...base,
    message: `Progress is available for ${aggregation.participantsWithProgressCount} of ${aggregation.activeParticipantCount} active participants.`,
    state: 'ready',
    statusLabel: 'Group progress available',
  }
}

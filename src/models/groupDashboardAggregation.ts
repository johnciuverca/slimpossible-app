import type { Challenge } from './challenge'
import {
  createParticipantDashboardView,
  type ParticipantDashboardParticipant,
} from './participantDashboard'
import type { WeighIn } from './weighIn'

export type GroupDashboardAggregationInput = {
  challenge: Challenge
  participants: readonly ParticipantDashboardParticipant[]
  weighIns: readonly WeighIn[]
}

export type GroupDashboardAggregation = {
  activeParticipantCount: number
  averageCompletionPercentage: number | null
  completionState: 'available' | 'unavailable'
  participantsWithProgressCount: number
  participantsWithRecordedWeightCount: number
  reachedTargetCount: number
  state: 'empty' | 'no-records' | 'ready'
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function createGroupDashboardAggregation({
  challenge,
  participants,
  weighIns,
}: GroupDashboardAggregationInput): GroupDashboardAggregation {
  const activeParticipants = participants.filter(
    (participant) =>
      participant.challengeId === challenge.id &&
      participant.status === 'active',
  )
  const dashboards = activeParticipants.map((participant) =>
    createParticipantDashboardView({
      challenge,
      participantId: participant.id,
      participants: [participant],
      weighIns,
    }),
  )
  const completionPercentages = dashboards
    .map((dashboard) => dashboard.completionPercentage)
    .filter((completionPercentage): completionPercentage is number =>
      Number.isFinite(completionPercentage),
    )
  const participantsWithRecordedWeightCount = dashboards.filter(
    (dashboard) => dashboard.state === 'ready',
  ).length

  if (activeParticipants.length === 0) {
    return {
      activeParticipantCount: 0,
      averageCompletionPercentage: null,
      completionState: 'unavailable',
      participantsWithProgressCount: 0,
      participantsWithRecordedWeightCount: 0,
      reachedTargetCount: 0,
      state: 'empty',
    }
  }

  if (participantsWithRecordedWeightCount === 0) {
    return {
      activeParticipantCount: activeParticipants.length,
      averageCompletionPercentage: null,
      completionState: 'unavailable',
      participantsWithProgressCount: 0,
      participantsWithRecordedWeightCount: 0,
      reachedTargetCount: 0,
      state: 'no-records',
    }
  }

  return {
    activeParticipantCount: activeParticipants.length,
    averageCompletionPercentage:
      completionPercentages.length > 0 ? average(completionPercentages) : null,
    completionState:
      completionPercentages.length > 0 ? 'available' : 'unavailable',
    participantsWithProgressCount: completionPercentages.length,
    participantsWithRecordedWeightCount,
    reachedTargetCount: dashboards.filter(
      (dashboard) => dashboard.progressState.state === 'target-reached',
    ).length,
    state: 'ready',
  }
}

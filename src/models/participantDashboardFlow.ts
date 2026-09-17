import {
  createParticipantDashboardView,
  type ParticipantDashboardInput,
  type ParticipantDashboardView,
} from './participantDashboard'
import {
  createParticipantFeaturePlaceholders,
  type ParticipantFeaturePlaceholders,
} from './participantFeaturePlaceholders'
import {
  createParticipantHistoryTrend,
  type ParticipantHistoryTrend,
} from './participantHistoryTrend'
import {
  createParticipantProgressSummary,
  type ParticipantProgressSummary,
} from './participantProgressSummary'

export type ParticipantDashboardFlow = {
  dashboard: ParticipantDashboardView
  featurePlaceholders: ParticipantFeaturePlaceholders
  historyTrend: ParticipantHistoryTrend
  progressSummary: ParticipantProgressSummary
}

export function createParticipantDashboardFlow(
  input: ParticipantDashboardInput,
): ParticipantDashboardFlow {
  const dashboard = createParticipantDashboardView(input)
  const participantWeighIns = dashboard.participant ? input.weighIns : []
  const historyTrend = createParticipantHistoryTrend(
    participantWeighIns,
    input.participantId,
  )

  return {
    dashboard,
    featurePlaceholders: createParticipantFeaturePlaceholders(historyTrend),
    historyTrend,
    progressSummary: createParticipantProgressSummary(dashboard),
  }
}

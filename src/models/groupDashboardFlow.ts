import {
  createActiveParticipantCards,
  type ActiveParticipantCardsInput,
} from './activeParticipantCards'
import {
  createGroupDashboardAggregation,
  type GroupDashboardAggregation,
} from './groupDashboardAggregation'
import { createGroupProgressSummary } from './groupProgressSummary'
import {
  createLeaderboardPlaceholder,
  type LeaderboardPlaceholder,
} from './leaderboardPlaceholder'
import {
  createPrivacyAwareGroupDisplay,
  type PrivacyAwareGroupDisplay,
} from './privacyAwareGroupDisplay'

export type GroupDashboardFlow = {
  aggregation: GroupDashboardAggregation
  display: PrivacyAwareGroupDisplay
  leaderboard: LeaderboardPlaceholder
}

export function createGroupDashboardFlow(
  input: ActiveParticipantCardsInput,
): GroupDashboardFlow {
  const aggregation = createGroupDashboardAggregation(input)
  const progressSummary = createGroupProgressSummary(aggregation)
  const participantCards = createActiveParticipantCards(input)

  return {
    aggregation,
    display: createPrivacyAwareGroupDisplay({
      participantCards,
      progressSummary,
    }),
    leaderboard: createLeaderboardPlaceholder(),
  }
}

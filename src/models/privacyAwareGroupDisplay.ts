import type { ActiveParticipantCard } from './activeParticipantCards'
import type {
  GroupProgressSummary,
  GroupProgressSummaryState,
} from './groupProgressSummary'
import type { ParticipantProgressSummaryState } from './participantProgressSummary'

export type GroupDisplayCard = {
  completionPercentage: number | null
  displayName: string
  message: string
  participantId: string
  state: ParticipantProgressSummaryState
  statusLabel: string
}

export type GroupDisplaySummary = {
  activeParticipantCount: number
  averageCompletionPercentage: number | null
  message: string
  participantsWithProgressCount: number
  participantsWithRecordedWeightCount: number
  reachedTargetCount: number
  state: GroupProgressSummaryState
  statusLabel: string
}

export type PrivacyAwareGroupDisplay = {
  participantCards: GroupDisplayCard[]
  progressSummary: GroupDisplaySummary
}

export type PrivacyAwareGroupDisplayInput = {
  participantCards: readonly ActiveParticipantCard[]
  progressSummary: GroupProgressSummary
}

function createGroupDisplaySummary({
  activeParticipantCount,
  averageCompletionPercentage,
  message,
  participantsWithProgressCount,
  participantsWithRecordedWeightCount,
  reachedTargetCount,
  state,
  statusLabel,
}: GroupProgressSummary): GroupDisplaySummary {
  return {
    activeParticipantCount,
    averageCompletionPercentage,
    message,
    participantsWithProgressCount,
    participantsWithRecordedWeightCount,
    reachedTargetCount,
    state,
    statusLabel,
  }
}

function createGroupDisplayCard({
  completionPercentage,
  displayName,
  message,
  participantId,
  state,
  statusLabel,
}: ActiveParticipantCard): GroupDisplayCard {
  return {
    completionPercentage,
    displayName,
    message,
    participantId,
    state,
    statusLabel,
  }
}

export function createPrivacyAwareGroupDisplay({
  participantCards,
  progressSummary,
}: PrivacyAwareGroupDisplayInput): PrivacyAwareGroupDisplay {
  return {
    participantCards: participantCards.map(createGroupDisplayCard),
    progressSummary: createGroupDisplaySummary(progressSummary),
  }
}

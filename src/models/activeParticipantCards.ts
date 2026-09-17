import type { Challenge } from './challenge'
import {
  createParticipantDashboardView,
  type ParticipantDashboardParticipant,
} from './participantDashboard'
import {
  createParticipantProgressSummary,
  type ParticipantProgressSummaryState,
} from './participantProgressSummary'
import type { WeighIn } from './weighIn'

export type ActiveParticipantCardsInput = {
  challenge: Challenge
  participants: readonly ParticipantDashboardParticipant[]
  weighIns: readonly WeighIn[]
}

export type ActiveParticipantCard = {
  completionPercentage: number | null
  displayName: string
  message: string
  participantId: string
  state: ParticipantProgressSummaryState
  statusLabel: string
}

export function createActiveParticipantCards({
  challenge,
  participants,
  weighIns,
}: ActiveParticipantCardsInput): ActiveParticipantCard[] {
  return participants
    .filter(
      (participant) =>
        participant.challengeId === challenge.id &&
        participant.status === 'active',
    )
    .map((participant) => {
      const dashboard = createParticipantDashboardView({
        challenge,
        participantId: participant.id,
        participants: [participant],
        weighIns,
      })
      const summary = createParticipantProgressSummary(dashboard)

      return {
        completionPercentage: summary.completionPercentage,
        displayName: participant.displayName,
        message: summary.message,
        participantId: participant.id,
        state: summary.state,
        statusLabel: summary.statusLabel,
      }
    })
}

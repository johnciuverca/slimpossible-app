import type { ParticipantDashboardView } from './participantDashboard'

export const milestoneThresholds = [25, 50, 75, 100] as const

export type MilestoneThreshold = (typeof milestoneThresholds)[number]

export type ParticipantMilestone = {
  id: string
  state: 'reached' | 'upcoming'
  thresholdPercentage: MilestoneThreshold
}

export type ParticipantMilestones =
  | {
      challengeId: string
      completionPercentage: number
      milestones: ParticipantMilestone[]
      participantId: string
      state: 'available'
    }
  | {
      challengeId: string
      completionPercentage: null
      milestones: []
      participantId: string | null
      reason: 'no-records' | 'no-target' | 'participant-not-found'
      state: 'unavailable'
    }

export function createParticipantMilestones(
  dashboard: ParticipantDashboardView,
): ParticipantMilestones {
  const participantId = dashboard.participant?.id ?? null
  const unavailable = (
    reason: 'no-records' | 'no-target' | 'participant-not-found',
  ): ParticipantMilestones => ({
    challengeId: dashboard.challenge.id,
    completionPercentage: null,
    milestones: [],
    participantId,
    reason,
    state: 'unavailable',
  })

  if (dashboard.state === 'participant-not-found') {
    return unavailable('participant-not-found')
  }

  if (dashboard.state === 'no-records') {
    return unavailable('no-records')
  }

  if (
    dashboard.progress.state === 'no-target' ||
    dashboard.progress.completionPercentage === null
  ) {
    return unavailable('no-target')
  }

  const completionPercentage = dashboard.progress.completionPercentage

  return {
    challengeId: dashboard.challenge.id,
    completionPercentage,
    milestones: milestoneThresholds.map((thresholdPercentage) => ({
      id: `${dashboard.challenge.id}:${participantId}:${thresholdPercentage}`,
      state:
        completionPercentage >= thresholdPercentage ? 'reached' : 'upcoming',
      thresholdPercentage,
    })),
    participantId: participantId!,
    state: 'available',
  }
}

import type { Challenge } from './challenge'
import type { Participant } from './participant'
import type { PersonalWeighIn } from './personalWeighIn'
import { createParticipantDashboardView } from './participantDashboard'

export function ownDashboardGoal(
  challenge: Challenge,
  participant: Participant,
  userId: string,
  entries: readonly PersonalWeighIn[],
  today: string,
) {
  if (
    participant.userId !== userId ||
    participant.challengeId !== challenge.id ||
    participant.status !== 'active'
  )
    return null
  const joined = participant.joinedAt ? new Date(participant.joinedAt) : null
  const enrollmentDate =
    joined && Number.isFinite(joined.getTime())
      ? joined.toISOString().slice(0, 10)
      : null
  const qualifying = entries.filter(
    (entry) =>
      entry.date <= today &&
      (challenge.kind !== 'group' ||
        (entry.sharedChallengeIds.includes(challenge.id) &&
          !!enrollmentDate &&
          entry.date >= enrollmentDate)),
  )
  const dashboard = createParticipantDashboardView({
    challenge,
    participantId: participant.id,
    participants: [participant],
    weighIns: qualifying.map((entry) => ({
      participantId: participant.id,
      date: entry.date,
      weightKg: entry.weightKg,
    })),
  })
  const equalBaseline =
    challenge.kind === 'group' &&
    participant.targetWeightKg === participant.startingWeightKg
  const invalidTarget =
    challenge.kind === 'group' &&
    participant.targetWeightKg > participant.startingWeightKg
  const reached =
    equalBaseline ||
    qualifying.some((entry) => entry.weightKg <= participant.targetWeightKg)
  if (equalBaseline) {
    dashboard.completionPercentage = 100
    dashboard.remainingTargetWeightKg = 0
    dashboard.progress = {
      state: 'target-set',
      direction: 'loss',
      completionPercentage: 100,
      remainingKg: 0,
    }
    dashboard.progressState = { state: 'target-reached', direction: 'loss' }
    dashboard.state = 'ready'
  } else if (invalidTarget) {
    dashboard.completionPercentage = null
    dashboard.remainingTargetWeightKg = null
    dashboard.progress = {
      state: 'no-target',
      direction: null,
      completionPercentage: null,
      remainingKg: null,
    }
    dashboard.progressState = { state: 'no-target', direction: null }
  }
  return { dashboard, reached, equalBaseline, invalidTarget }
}

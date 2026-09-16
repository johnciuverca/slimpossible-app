import type { DateOnly } from './challenge'
import type { ParticipantDashboardParticipant } from './participantDashboard'
import type { WeighIn } from './weighIn'

export type WeeklyChallengeScope = 'group' | 'individual'

export type WeeklyProgressCandidate = {
  participantId: string
  weeklyWeightChangeKg: number
}

export type WeeklyProgressEligibilityInput = {
  challengeId: string
  challengeScope: WeeklyChallengeScope
  currentSunday: DateOnly
  participants: readonly ParticipantDashboardParticipant[]
  previousSunday: DateOnly
  weighIns: readonly WeighIn[]
}

export type WeeklyProgressEligibility = {
  activeParticipantCount: number
  candidates: WeeklyProgressCandidate[]
  currentSunday: DateOnly
  previousSunday: DateOnly
  state:
    | 'eligible-candidates'
    | 'invalid-sunday-pair'
    | 'no-eligible-participants'
    | 'not-group-challenge'
}

function isSunday(dateOnly: DateOnly) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === dateOnly && date.getUTCDay() === 0
}

function findWeighIn(
  weighIns: readonly WeighIn[],
  participantId: string,
  date: DateOnly,
) {
  return weighIns.find(
    (weighIn) =>
      weighIn.participantId === participantId && weighIn.date === date,
  )
}

export function determineWeeklyProgressEligibility({
  challengeId,
  challengeScope,
  currentSunday,
  participants,
  previousSunday,
  weighIns,
}: WeeklyProgressEligibilityInput): WeeklyProgressEligibility {
  const activeParticipants = participants.filter(
    (participant) =>
      participant.challengeId === challengeId &&
      participant.status === 'active',
  )
  const base = {
    activeParticipantCount: activeParticipants.length,
    currentSunday,
    previousSunday,
  }

  if (challengeScope !== 'group') {
    return { ...base, candidates: [], state: 'not-group-challenge' }
  }

  if (!isSunday(currentSunday) || !isSunday(previousSunday)) {
    return { ...base, candidates: [], state: 'invalid-sunday-pair' }
  }

  const candidates = activeParticipants.flatMap((participant) => {
    const previousWeighIn = findWeighIn(
      weighIns,
      participant.id,
      previousSunday,
    )
    const currentWeighIn = findWeighIn(weighIns, participant.id, currentSunday)

    if (!previousWeighIn || !currentWeighIn) return []

    return [
      {
        participantId: participant.id,
        weeklyWeightChangeKg:
          currentWeighIn.weightKg - previousWeighIn.weightKg,
      },
    ]
  })

  return {
    ...base,
    candidates,
    state:
      candidates.length > 0
        ? 'eligible-candidates'
        : 'no-eligible-participants',
  }
}

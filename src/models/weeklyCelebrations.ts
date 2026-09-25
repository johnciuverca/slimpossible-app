import type {
  MilestoneThreshold,
  ParticipantMilestones,
} from './participantMilestones'
import type { GroupProgressSummary } from './groupProgress'
import type { WeeklyProgressEligibility } from './weeklyProgressEligibility'
import type { WeeklyWinners } from './weeklyWinners'

export type WeeklyCelebrationMilestone = {
  state: 'reached' | 'upcoming'
  thresholdPercentage: MilestoneThreshold
}

export type MilestoneCelebrationContext =
  | {
      challengeId: string
      milestones: WeeklyCelebrationMilestone[]
      participantId: string
      state: 'available'
    }
  | {
      challengeId: string
      milestones: []
      participantId: string | null
      reason:
        | 'invalid-progress'
        | 'no-records'
        | 'no-target'
        | 'participant-not-found'
      state: 'unavailable'
    }

export type WeeklyWinCelebration = {
  activeParticipantCount: number
  eligibleParticipantCount: number
  message: string
  participation: 'complete' | 'none' | 'partial'
  state: 'no-eligible-candidates' | 'shared-winners' | 'single-winner'
  winnerParticipantIds: string[]
}

export type WeeklyCelebrations = {
  milestoneCelebrations: MilestoneCelebrationContext[]
  weeklyWin: WeeklyWinCelebration
}

export type WeeklyCelebrationsInput = {
  eligibility: WeeklyProgressEligibility
  participantMilestones: readonly ParticipantMilestones[]
  winners: WeeklyWinners
}

export type SavedWeeklyWinCelebration = {
  activeParticipantCount: number
  challengeId: string
  currentSunday: string
  eligibleParticipantCount: number
  message: string
  previousSunday: string
  state: 'no-eligible-candidates' | 'shared-winners' | 'single-winner'
  winnerNames: string[]
}

function participation(
  activeParticipantCount: number,
  eligibleParticipantCount: number,
): WeeklyWinCelebration['participation'] {
  if (eligibleParticipantCount === 0) return 'none'
  return eligibleParticipantCount === activeParticipantCount
    ? 'complete'
    : 'partial'
}

function participationCopy(
  activeParticipantCount: number,
  eligibleParticipantCount: number,
) {
  return eligibleParticipantCount === activeParticipantCount
    ? ''
    : ` Based on ${eligibleParticipantCount} of ${activeParticipantCount} active participants.`
}

function createWeeklyWinCelebration(
  eligibility: WeeklyProgressEligibility,
  winners: WeeklyWinners,
): WeeklyWinCelebration {
  const eligibleParticipantCount = eligibility.candidates.length
  const activeParticipantCount = eligibility.activeParticipantCount
  const currentParticipation = participation(
    activeParticipantCount,
    eligibleParticipantCount,
  )
  const base = {
    activeParticipantCount,
    eligibleParticipantCount,
    participation: currentParticipation,
  }

  if (winners.state === 'no-winners') {
    return {
      ...base,
      message:
        'No weekly result is available until participants record both Sunday weigh-ins.',
      state: 'no-eligible-candidates',
      winnerParticipantIds: [],
    }
  }

  if (winners.state === 'shared-winners') {
    return {
      ...base,
      message: `${winners.winners.length} shared weekly winners are ready.${participationCopy(activeParticipantCount, eligibleParticipantCount)}`,
      state: 'shared-winners',
      winnerParticipantIds: winners.winners.map(
        ({ participantId }) => participantId,
      ),
    }
  }

  return {
    ...base,
    message: `1 weekly winner is ready.${participationCopy(activeParticipantCount, eligibleParticipantCount)}`,
    state: 'single-winner',
    winnerParticipantIds: winners.winners.map(
      ({ participantId }) => participantId,
    ),
  }
}

export function createSavedWeeklyWinCelebration(
  summary: GroupProgressSummary,
): SavedWeeklyWinCelebration {
  const participationMessage =
    summary.eligibleParticipantCount === summary.activeParticipantCount
      ? ''
      : ` based on ${summary.eligibleParticipantCount} of ${summary.activeParticipantCount} active members.`
  const winnerNames = [...summary.weeklyWinnerNames]
  const base = {
    activeParticipantCount: summary.activeParticipantCount,
    challengeId: summary.challengeId,
    currentSunday: summary.currentSunday,
    eligibleParticipantCount: summary.eligibleParticipantCount,
    previousSunday: summary.previousSunday,
    winnerNames,
  }

  if (summary.weeklyWinnerCount === 0 || winnerNames.length === 0) {
    return {
      ...base,
      message:
        'No weekly result is available until participants record both Sunday weigh-ins.',
      state: 'no-eligible-candidates',
    }
  }

  if (summary.weeklyWinnerCount > 1) {
    return {
      ...base,
      message: `${summary.weeklyWinnerCount} shared weekly winners are ready.${participationMessage}`,
      state: 'shared-winners',
    }
  }

  return {
    ...base,
    message: `1 weekly winner is ready.${participationMessage}`,
    state: 'single-winner',
  }
}

function createMilestoneCelebration(
  milestones: ParticipantMilestones,
): MilestoneCelebrationContext {
  if (milestones.state === 'unavailable') {
    return {
      challengeId: milestones.challengeId,
      milestones: [],
      participantId: milestones.participantId,
      reason: milestones.reason,
      state: 'unavailable',
    }
  }

  const uniqueMilestones = new Map<
    MilestoneThreshold,
    WeeklyCelebrationMilestone
  >()
  milestones.milestones.forEach(({ state, thresholdPercentage }) => {
    uniqueMilestones.set(thresholdPercentage, { state, thresholdPercentage })
  })

  return {
    challengeId: milestones.challengeId,
    milestones: [...uniqueMilestones.values()],
    participantId: milestones.participantId,
    state: 'available',
  }
}

export function createWeeklyCelebrations({
  eligibility,
  participantMilestones,
  winners,
}: WeeklyCelebrationsInput): WeeklyCelebrations {
  const uniqueCelebrations = new Map<string, MilestoneCelebrationContext>()

  participantMilestones.forEach((milestones) => {
    const celebration = createMilestoneCelebration(milestones)
    uniqueCelebrations.set(
      `${celebration.challengeId}:${celebration.participantId ?? 'unavailable'}`,
      celebration,
    )
  })

  return {
    milestoneCelebrations: [...uniqueCelebrations.values()],
    weeklyWin: createWeeklyWinCelebration(eligibility, winners),
  }
}

import type { Challenge } from './challenge'
import type { Participant } from './participant'
import { determineProgressState, type ProgressState } from './progressState'
import { calculateTargetProgress, type TargetProgress } from './targetProgress'
import type { WeighIn } from './weighIn'
import {
  calculateDailyWeightChange,
  calculateTotalWeightChange,
} from './weightChange'

export type ParticipantDashboardParticipant = Omit<
  Participant,
  'targetWeightKg'
> & {
  targetWeightKg?: number
}

export type ParticipantDashboardInput = {
  challenge: Challenge
  participantId: string
  participants: readonly ParticipantDashboardParticipant[]
  weighIns: readonly WeighIn[]
}

export type ParticipantDashboardView = {
  challenge: Challenge
  completionPercentage: number | null
  currentWeightKg: number | null
  dailyChangeKg: number | null
  latestWeighIn: WeighIn | null
  participant: ParticipantDashboardParticipant | null
  progress: TargetProgress
  progressState: ProgressState
  remainingTargetWeightKg: number | null
  startingWeightKg: number | null
  state: 'participant-not-found' | 'no-records' | 'ready'
  targetWeightKg: number | null
  totalChangeKg: number | null
}

function noTargetProgress(): TargetProgress {
  return {
    completionPercentage: null,
    direction: null,
    remainingKg: null,
    state: 'no-target',
  }
}

function noTargetProgressState(): ProgressState {
  return { direction: null, state: 'no-target' }
}

function findParticipant(
  participants: readonly ParticipantDashboardParticipant[],
  challengeId: string,
  participantId: string,
) {
  return participants.find(
    (participant) =>
      participant.id === participantId &&
      participant.challengeId === challengeId,
  )
}

function findLatestWeighIn(
  weighIns: readonly WeighIn[],
  participantId: string,
) {
  return weighIns
    .filter((weighIn) => weighIn.participantId === participantId)
    .sort((first, second) => second.date.localeCompare(first.date))[0]
}

export function createParticipantDashboardView({
  challenge,
  participantId,
  participants,
  weighIns,
}: ParticipantDashboardInput): ParticipantDashboardView {
  const participant = findParticipant(participants, challenge.id, participantId)

  if (!participant) {
    return {
      challenge,
      completionPercentage: null,
      currentWeightKg: null,
      dailyChangeKg: null,
      latestWeighIn: null,
      participant: null,
      progress: noTargetProgress(),
      progressState: noTargetProgressState(),
      remainingTargetWeightKg: null,
      startingWeightKg: null,
      state: 'participant-not-found',
      targetWeightKg: null,
      totalChangeKg: null,
    }
  }

  const latestWeighIn = findLatestWeighIn(weighIns, participant.id)
  const targetWeightKg = participant.targetWeightKg ?? null

  if (!latestWeighIn) {
    return {
      challenge,
      completionPercentage: null,
      currentWeightKg: null,
      dailyChangeKg: null,
      latestWeighIn: null,
      participant,
      progress: noTargetProgress(),
      progressState: noTargetProgressState(),
      remainingTargetWeightKg: null,
      startingWeightKg: participant.startingWeightKg,
      state: 'no-records',
      targetWeightKg,
      totalChangeKg: null,
    }
  }

  const progressInput = {
    currentWeightKg: latestWeighIn.weightKg,
    startingWeightKg: participant.startingWeightKg,
    targetWeightKg: participant.targetWeightKg,
  }
  const progress = calculateTargetProgress(progressInput)

  return {
    challenge,
    completionPercentage: progress.completionPercentage,
    currentWeightKg: latestWeighIn.weightKg,
    dailyChangeKg: calculateDailyWeightChange(
      weighIns,
      participant.id,
      latestWeighIn.date,
    ),
    latestWeighIn,
    participant,
    progress,
    progressState: determineProgressState(progressInput),
    remainingTargetWeightKg: progress.remainingKg,
    startingWeightKg: participant.startingWeightKg,
    state: 'ready',
    targetWeightKg,
    totalChangeKg: calculateTotalWeightChange(
      participant.startingWeightKg,
      weighIns,
      participant.id,
      latestWeighIn.date,
    ),
  }
}

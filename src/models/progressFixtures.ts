import type { TargetProgressInput } from './targetProgress'
import type { WeighIn } from './weighIn'

export const progressParticipantId = 'participant-progress'

export const normalLossWeighIns: readonly WeighIn[] = [
  {
    date: '2026-09-13',
    participantId: progressParticipantId,
    weightKg: 100,
  },
  {
    date: '2026-09-15',
    participantId: progressParticipantId,
    weightKg: 95,
  },
]

export const normalLossTarget: TargetProgressInput = {
  currentWeightKg: 95,
  startingWeightKg: 100,
  targetWeightKg: 80,
}

export const gainWeighIns: readonly WeighIn[] = [
  {
    date: '2026-09-13',
    participantId: progressParticipantId,
    weightKg: 70,
  },
  {
    date: '2026-09-15',
    participantId: progressParticipantId,
    weightKg: 75,
  },
]

export const gainTarget: TargetProgressInput = {
  currentWeightKg: 75,
  startingWeightKg: 70,
  targetWeightKg: 80,
}

export const missingDayDate = '2026-09-14'

export const noTargetProgress: TargetProgressInput = {
  currentWeightKg: 95,
  startingWeightKg: 100,
}

export const reachedLossTarget: TargetProgressInput = {
  currentWeightKg: 80,
  startingWeightKg: 100,
  targetWeightKg: 80,
}

export const reachedGainOvershootTarget: TargetProgressInput = {
  currentWeightKg: 82,
  startingWeightKg: 70,
  targetWeightKg: 80,
}

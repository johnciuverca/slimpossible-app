import type { WeeklyProgressEligibility } from './weeklyProgressEligibility'

export type WeeklyWinner = {
  participantId: string
}

export type WeeklyWinners = {
  bestWeeklyChangeKg: number | null
  state: 'no-winners' | 'shared-winners' | 'winner'
  winners: WeeklyWinner[]
}

export function determineWeeklyWinners({
  candidates,
}: WeeklyProgressEligibility): WeeklyWinners {
  if (candidates.length === 0) {
    return {
      bestWeeklyChangeKg: null,
      state: 'no-winners',
      winners: [],
    }
  }

  const bestWeeklyChangeKg = Math.min(
    ...candidates.map(({ weeklyWeightChangeKg }) => weeklyWeightChangeKg),
  )
  const winners = candidates
    .filter(
      (candidate) => candidate.weeklyWeightChangeKg === bestWeeklyChangeKg,
    )
    .map(({ participantId }) => ({ participantId }))

  return {
    bestWeeklyChangeKg,
    state: winners.length === 1 ? 'winner' : 'shared-winners',
    winners,
  }
}

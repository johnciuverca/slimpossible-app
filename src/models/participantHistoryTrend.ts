import type { WeighIn } from './weighIn'
import { sortWeighInsByDate } from './weighInStore'

export type ParticipantTrendDirection = 'gain' | 'loss' | 'unchanged'

export type ParticipantHistoryTrend = {
  history: WeighIn[]
  latestWeighIn: WeighIn | null
  recordCount: number
  state: 'no-records' | 'insufficient-history' | 'ready'
  trendChangeKg: number | null
  trendDirection: ParticipantTrendDirection | null
}

function trendDirection(changeKg: number): ParticipantTrendDirection {
  if (changeKg < 0) return 'loss'
  if (changeKg > 0) return 'gain'
  return 'unchanged'
}

export function createParticipantHistoryTrend(
  weighIns: readonly WeighIn[],
  participantId: string,
): ParticipantHistoryTrend {
  const history = sortWeighInsByDate(
    weighIns.filter((weighIn) => weighIn.participantId === participantId),
  )
  const latestWeighIn = history[0] ?? null

  if (history.length === 0) {
    return {
      history,
      latestWeighIn,
      recordCount: 0,
      state: 'no-records',
      trendChangeKg: null,
      trendDirection: null,
    }
  }

  if (history.length === 1) {
    return {
      history,
      latestWeighIn,
      recordCount: 1,
      state: 'insufficient-history',
      trendChangeKg: null,
      trendDirection: null,
    }
  }

  const earliestWeighIn = history.at(-1)!
  const trendChangeKg = latestWeighIn.weightKg - earliestWeighIn.weightKg

  return {
    history,
    latestWeighIn,
    recordCount: history.length,
    state: 'ready',
    trendChangeKg,
    trendDirection: trendDirection(trendChangeKg),
  }
}

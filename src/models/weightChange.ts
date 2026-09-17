import type { DateOnly } from './challenge'
import type { WeighIn } from './weighIn'

function isPositiveFiniteNumber(value: number) {
  return Number.isFinite(value) && value > 0
}

function latestRecordedWeighIn(
  weighIns: readonly WeighIn[],
  participantId: string,
  throughDate?: DateOnly,
) {
  return weighIns
    .filter(
      (weighIn) =>
        weighIn.participantId === participantId &&
        (throughDate === undefined || weighIn.date <= throughDate),
    )
    .sort((first, second) => second.date.localeCompare(first.date))[0]
}

function previousRecordedWeighIn(
  weighIns: readonly WeighIn[],
  participantId: string,
  date: DateOnly,
) {
  return latestRecordedWeighIn(
    weighIns.filter((weighIn) => weighIn.date < date),
    participantId,
  )
}

export function calculateDailyWeightChange(
  weighIns: readonly WeighIn[],
  participantId: string,
  date: DateOnly,
) {
  const current = weighIns.find(
    (weighIn) =>
      weighIn.participantId === participantId && weighIn.date === date,
  )
  if (!current) {
    return null
  }

  const previous = previousRecordedWeighIn(weighIns, participantId, date)
  return previous ? current.weightKg - previous.weightKg : null
}

export function calculateTotalWeightChange(
  startingWeightKg: number,
  weighIns: readonly WeighIn[],
  participantId: string,
  throughDate?: DateOnly,
) {
  if (!isPositiveFiniteNumber(startingWeightKg)) {
    return null
  }

  const latest = latestRecordedWeighIn(weighIns, participantId, throughDate)
  return latest ? latest.weightKg - startingWeightKg : null
}

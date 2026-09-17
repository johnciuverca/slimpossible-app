import {
  validateWeighIn,
  type WeighIn,
  type WeighInValidationIssue,
  type WeighInValidationOptions,
} from './weighIn'

export type WeighInStoreResult =
  | { data: WeighIn[]; operation: 'created' | 'updated'; success: true }
  | { issues: WeighInValidationIssue[]; success: false }

export function findWeighInForDate(
  weighIns: readonly WeighIn[],
  participantId: string,
  date: WeighIn['date'],
) {
  return weighIns.find(
    (weighIn) =>
      weighIn.participantId === participantId && weighIn.date === date,
  )
}

export function sortWeighInsByDate(weighIns: readonly WeighIn[]): WeighIn[] {
  return [...weighIns].sort((first, second) =>
    second.date.localeCompare(first.date),
  )
}

export function upsertWeighIn(
  weighIns: readonly WeighIn[],
  input: unknown,
  options?: WeighInValidationOptions,
): WeighInStoreResult {
  const validation = validateWeighIn(input, options)
  if (!validation.success) {
    return validation
  }

  const existingIndex = weighIns.findIndex(
    (weighIn) =>
      weighIn.participantId === validation.data.participantId &&
      weighIn.date === validation.data.date,
  )

  if (existingIndex === -1) {
    return {
      data: [...weighIns, validation.data],
      operation: 'created',
      success: true,
    }
  }

  return {
    data: weighIns.map((weighIn, index) =>
      index === existingIndex ? validation.data : weighIn,
    ),
    operation: 'updated',
    success: true,
  }
}

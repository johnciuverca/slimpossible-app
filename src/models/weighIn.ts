import type { DateOnly } from './challenge'

export type WeighIn = {
  date: DateOnly
  id: string
  note?: string
  participantId: string
  weightKg: number
}

export type WeighInValidationField = keyof WeighIn

export type WeighInValidationIssue = {
  field: WeighInValidationField
  message: string
}

export type WeighInValidationResult =
  | { data: WeighIn; success: true }
  | { issues: WeighInValidationIssue[]; success: false }

export type WeighInValidationOptions = {
  today?: DateOnly
}

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function todayAsDateOnly() {
  return new Date().toISOString().slice(0, 10) as DateOnly
}

function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === value
}

function addRequiredStringIssue(
  input: Record<string, unknown>,
  field: WeighInValidationField,
  label: string,
  issues: WeighInValidationIssue[],
) {
  const value = input[field]
  if (typeof value !== 'string' || !value.trim()) {
    issues.push({ field, message: `${label} is required.` })
  }
}

export function validateWeighIn(
  input: unknown,
  { today = todayAsDateOnly() }: WeighInValidationOptions = {},
): WeighInValidationResult {
  if (!isRecord(input)) {
    return {
      issues: [{ field: 'id', message: 'Weigh-in must be an object.' }],
      success: false,
    }
  }

  const issues: WeighInValidationIssue[] = []

  addRequiredStringIssue(input, 'id', 'Weigh-in id', issues)
  addRequiredStringIssue(input, 'participantId', 'Participant id', issues)

  if (!isValidDateOnly(input.date)) {
    issues.push({
      field: 'date',
      message: 'Date must be a valid YYYY-MM-DD date.',
    })
  } else if (isValidDateOnly(today) && input.date > today) {
    issues.push({
      field: 'date',
      message: 'Weigh-in date cannot be in the future.',
    })
  }

  if (
    typeof input.weightKg !== 'number' ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg <= 0
  ) {
    issues.push({
      field: 'weightKg',
      message: 'Weight must be a positive finite number.',
    })
  }

  if (input.note !== undefined && typeof input.note !== 'string') {
    issues.push({
      field: 'note',
      message: 'Note must be text when provided.',
    })
  }

  if (issues.length > 0) {
    return { issues, success: false }
  }

  return {
    data: input as WeighIn,
    success: true,
  }
}

export function findWeighInForDate(
  weighIns: WeighIn[],
  participantId: string,
  date: DateOnly,
  excludeId?: string,
) {
  return weighIns.find(
    (weighIn) =>
      weighIn.id !== excludeId &&
      weighIn.participantId === participantId &&
      weighIn.date === date,
  )
}

export function getWeightChangeForDate(
  weighIns: WeighIn[],
  participantId: string,
  date: DateOnly,
) {
  const current = findWeighInForDate(weighIns, participantId, date)
  if (!current) {
    return null
  }

  const previous = weighIns
    .filter(
      (weighIn) =>
        weighIn.participantId === participantId && weighIn.date < current.date,
    )
    .sort((first, second) => second.date.localeCompare(first.date))[0]

  return previous ? current.weightKg - previous.weightKg : null
}

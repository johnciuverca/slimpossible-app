import type { DateOnly } from './challenge'

export type WeighIn = {
  date: DateOnly
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

function todayAsDateOnly(): DateOnly {
  return new Date().toISOString().slice(0, 10)
}

function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === value
}

export function validateWeighIn(
  input: unknown,
  { today = todayAsDateOnly() }: WeighInValidationOptions = {},
): WeighInValidationResult {
  if (!isRecord(input)) {
    return {
      issues: [
        {
          field: 'participantId',
          message: 'Weigh-in must be an object.',
        },
      ],
      success: false,
    }
  }

  const issues: WeighInValidationIssue[] = []

  if (typeof input.participantId !== 'string' || !input.participantId.trim()) {
    issues.push({
      field: 'participantId',
      message: 'Participant id is required.',
    })
  }

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

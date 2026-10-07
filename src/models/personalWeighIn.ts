import type { DateOnly } from './challenge'

export type PersonalWeighIn = {
  id: string
  date: DateOnly
  note?: string
  sharedChallengeIds: string[]
  weightKg: number
}

export type PersonalWeighInInput = {
  id?: string
  date: DateOnly
  note?: string
  sharedChallengeIds: string[]
  weightKg: number
}

export type PersonalWeighInValidationIssue = {
  field: keyof PersonalWeighInInput
  message: string
}

export type PersonalWeighInValidationResult =
  | { data: PersonalWeighInInput; success: true }
  | { issues: PersonalWeighInValidationIssue[]; success: false }

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

export function personalWeighInToday(date = new Date()): DateOnly {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export function validatePersonalWeighIn(
  input: unknown,
  today = personalWeighInToday(),
): PersonalWeighInValidationResult {
  if (typeof input !== 'object' || input === null) {
    return {
      issues: [{ field: 'date', message: 'Weigh-in must be an object.' }],
      success: false,
    }
  }

  const value = input as Partial<PersonalWeighInInput>
  const issues: PersonalWeighInValidationIssue[] = []

  if (!isDateOnly(value.date) || value.date > today) {
    issues.push({
      field: 'date',
      message: 'Choose a valid date that is not in the future.',
    })
  }
  if (
    typeof value.weightKg !== 'number' ||
    !Number.isFinite(value.weightKg) ||
    value.weightKg <= 0
  ) {
    issues.push({
      field: 'weightKg',
      message: 'Weight must be a positive finite number.',
    })
  }
  if (value.note !== undefined && typeof value.note !== 'string') {
    issues.push({ field: 'note', message: 'Note must be text when provided.' })
  }
  if (
    !Array.isArray(value.sharedChallengeIds) ||
    value.sharedChallengeIds.some((id) => typeof id !== 'string') ||
    new Set(value.sharedChallengeIds).size !== value.sharedChallengeIds.length
  ) {
    issues.push({
      field: 'sharedChallengeIds',
      message: 'Choose each group at most once.',
    })
  }
  if (value.id !== undefined && (typeof value.id !== 'string' || !value.id)) {
    issues.push({ field: 'id', message: 'Entry id is invalid.' })
  }

  return issues.length > 0
    ? { issues, success: false }
    : { data: value as PersonalWeighInInput, success: true }
}

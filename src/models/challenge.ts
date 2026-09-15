export const challengeStatuses = [
  'draft',
  'active',
  'completed',
  'archived',
] as const

export type ChallengeStatus = (typeof challengeStatuses)[number]
export type DateOnly = string

export type Challenge = {
  createdAt: string
  createdBy: string
  description?: string
  endDate: DateOnly
  id: string
  name: string
  ownerId: string
  startDate: DateOnly
  status: ChallengeStatus
  targetWeightKg?: number
  updatedAt: string
}

export type ChallengeValidationField = keyof Challenge

export type ChallengeValidationIssue = {
  field: ChallengeValidationField
  message: string
}

export type ChallengeValidationResult =
  | { data: Challenge; success: true }
  | { issues: ChallengeValidationIssue[]; success: false }

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !dateOnlyPattern.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === value
}

function isValidDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.includes('T') &&
    !Number.isNaN(Date.parse(value))
  )
}

function addRequiredStringIssue(
  input: Record<string, unknown>,
  field: ChallengeValidationField,
  label: string,
  issues: ChallengeValidationIssue[],
) {
  const value = input[field]
  if (typeof value !== 'string' || !value.trim()) {
    issues.push({ field, message: `${label} is required.` })
  }
}

function isChallengeStatus(value: unknown): value is ChallengeStatus {
  return (
    typeof value === 'string' &&
    challengeStatuses.includes(value as ChallengeStatus)
  )
}

export function validateChallenge(input: unknown): ChallengeValidationResult {
  if (!isRecord(input)) {
    return {
      issues: [{ field: 'id', message: 'Challenge must be an object.' }],
      success: false,
    }
  }

  const issues: ChallengeValidationIssue[] = []

  addRequiredStringIssue(input, 'id', 'Challenge id', issues)
  addRequiredStringIssue(input, 'name', 'Challenge name', issues)
  addRequiredStringIssue(input, 'ownerId', 'Owner id', issues)
  addRequiredStringIssue(input, 'createdBy', 'Created-by id', issues)

  if (
    input.description !== undefined &&
    typeof input.description !== 'string'
  ) {
    issues.push({
      field: 'description',
      message: 'Description must be text when provided.',
    })
  }

  if (!isValidDateOnly(input.startDate)) {
    issues.push({
      field: 'startDate',
      message: 'Start date must be a valid YYYY-MM-DD date.',
    })
  }

  if (!isValidDateOnly(input.endDate)) {
    issues.push({
      field: 'endDate',
      message: 'End date must be a valid YYYY-MM-DD date.',
    })
  }

  if (
    isValidDateOnly(input.startDate) &&
    isValidDateOnly(input.endDate) &&
    input.startDate > input.endDate
  ) {
    issues.push({
      field: 'endDate',
      message: 'End date must be on or after the start date.',
    })
  }

  if (!isChallengeStatus(input.status)) {
    issues.push({
      field: 'status',
      message: `Status must be one of: ${challengeStatuses.join(', ')}.`,
    })
  }

  if (
    input.targetWeightKg !== undefined &&
    (typeof input.targetWeightKg !== 'number' ||
      !Number.isFinite(input.targetWeightKg) ||
      input.targetWeightKg <= 0)
  ) {
    issues.push({
      field: 'targetWeightKg',
      message: 'Target weight must be a positive finite number when provided.',
    })
  }

  if (!isValidDateTime(input.createdAt)) {
    issues.push({
      field: 'createdAt',
      message: 'Created-at must be a valid date-time string.',
    })
  }

  if (!isValidDateTime(input.updatedAt)) {
    issues.push({
      field: 'updatedAt',
      message: 'Updated-at must be a valid date-time string.',
    })
  }

  if (issues.length > 0) {
    return { issues, success: false }
  }

  return {
    data: input as Challenge,
    success: true,
  }
}

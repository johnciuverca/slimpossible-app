export const participantStatuses = [
  'invited',
  'active',
  'completed',
  'withdrawn',
] as const

export type ParticipantStatus = (typeof participantStatuses)[number]

export type Participant = {
  challengeId: string
  displayName: string
  id: string
  joinedAt?: string
  status: ParticipantStatus
  startingWeightKg: number
  targetWeightKg: number
  userId: string
}

export type ParticipantValidationField = keyof Participant

export type ParticipantValidationIssue = {
  field: ParticipantValidationField
  message: string
}

export type ParticipantValidationResult =
  | { data: Participant; success: true }
  | { issues: ParticipantValidationIssue[]; success: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  field: ParticipantValidationField,
  label: string,
  issues: ParticipantValidationIssue[],
) {
  const value = input[field]
  if (typeof value !== 'string' || !value.trim()) {
    issues.push({ field, message: `${label} is required.` })
  }
}

function isParticipantStatus(value: unknown): value is ParticipantStatus {
  return (
    typeof value === 'string' &&
    participantStatuses.includes(value as ParticipantStatus)
  )
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function validateParticipant(
  input: unknown,
): ParticipantValidationResult {
  if (!isRecord(input)) {
    return {
      issues: [{ field: 'id', message: 'Participant must be an object.' }],
      success: false,
    }
  }

  const issues: ParticipantValidationIssue[] = []

  addRequiredStringIssue(input, 'id', 'Participant id', issues)
  addRequiredStringIssue(input, 'challengeId', 'Challenge id', issues)
  addRequiredStringIssue(input, 'userId', 'User id', issues)
  addRequiredStringIssue(input, 'displayName', 'Display name', issues)

  if (!isParticipantStatus(input.status)) {
    issues.push({
      field: 'status',
      message: `Status must be one of: ${participantStatuses.join(', ')}.`,
    })
  }

  if (!isPositiveFiniteNumber(input.startingWeightKg)) {
    issues.push({
      field: 'startingWeightKg',
      message: 'Starting weight must be a positive finite number.',
    })
  }

  if (!isPositiveFiniteNumber(input.targetWeightKg)) {
    issues.push({
      field: 'targetWeightKg',
      message: 'Target weight must be a positive finite number.',
    })
  }

  if (input.joinedAt !== undefined && !isValidDateTime(input.joinedAt)) {
    issues.push({
      field: 'joinedAt',
      message: 'Joined-at must be a valid date-time string when provided.',
    })
  }

  if (
    isParticipantStatus(input.status) &&
    input.status !== 'invited' &&
    !isValidDateTime(input.joinedAt)
  ) {
    issues.push({
      field: 'joinedAt',
      message: 'Joined-at is required after an invitation is accepted.',
    })
  }

  if (issues.length > 0) {
    return { issues, success: false }
  }

  return {
    data: input as Participant,
    success: true,
  }
}

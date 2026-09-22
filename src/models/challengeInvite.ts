export const challengeInviteStatuses = ['active', 'expired', 'revoked'] as const

export type ChallengeInviteStatus = (typeof challengeInviteStatuses)[number]

export type ChallengeInvite = {
  challengeId: string
  createdAt: string
  expiresAt: string
  id: string
  revokedAt?: string
}

export type ChallengeInvitePreview = {
  challengeId: string
  challengeName: string
  expiresAt: string
  id: string
  revokedAt?: string
  status: ChallengeInviteStatus
}

export type InviteAcceptanceValues = {
  displayName: string
  startingWeightKg: number
  targetWeightKg: number
}

export type InviteValidationField = keyof InviteAcceptanceValues

export type InviteValidationIssue = {
  field: InviteValidationField
  message: string
}

export type InviteValidationResult =
  | { data: InviteAcceptanceValues; success: true }
  | { issues: InviteValidationIssue[]; success: false }

export function getChallengeInviteStatus(
  invite: Pick<ChallengeInvitePreview, 'expiresAt' | 'revokedAt'>,
  now = new Date(),
): ChallengeInviteStatus {
  if (invite.revokedAt) return 'revoked'
  return new Date(invite.expiresAt) <= now ? 'expired' : 'active'
}

export function validateInviteAcceptance(
  input: InviteAcceptanceValues,
): InviteValidationResult {
  const issues: InviteValidationIssue[] = []

  if (!input.displayName.trim()) {
    issues.push({ field: 'displayName', message: 'Enter your display name.' })
  }
  if (!Number.isFinite(input.startingWeightKg) || input.startingWeightKg <= 0) {
    issues.push({
      field: 'startingWeightKg',
      message: 'Starting weight must be a positive finite number.',
    })
  }
  if (!Number.isFinite(input.targetWeightKg) || input.targetWeightKg <= 0) {
    issues.push({
      field: 'targetWeightKg',
      message: 'Target weight must be a positive finite number.',
    })
  }

  return issues.length > 0
    ? { issues, success: false }
    : {
        data: {
          displayName: input.displayName.trim(),
          startingWeightKg: input.startingWeightKg,
          targetWeightKg: input.targetWeightKg,
        },
        success: true,
      }
}

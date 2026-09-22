import { describe, expect, it } from 'vitest'

import {
  getChallengeInviteStatus,
  validateInviteAcceptance,
} from './challengeInvite'

describe('challenge invites', () => {
  const now = new Date('2026-09-22T12:00:00.000Z')

  it('reports active, expired, and revoked invitations', () => {
    expect(
      getChallengeInviteStatus({ expiresAt: '2026-09-23T12:00:00.000Z' }, now),
    ).toBe('active')
    expect(
      getChallengeInviteStatus({ expiresAt: '2026-09-22T11:59:59.000Z' }, now),
    ).toBe('expired')
    expect(
      getChallengeInviteStatus(
        {
          expiresAt: '2026-09-23T12:00:00.000Z',
          revokedAt: '2026-09-22T11:00:00.000Z',
        },
        now,
      ),
    ).toBe('revoked')
  })

  it('validates acceptance details without accepting a user-entered identity', () => {
    expect(
      validateInviteAcceptance({
        displayName: '  Alex  ',
        startingWeightKg: 92.5,
        targetWeightKg: 80,
      }),
    ).toEqual({
      data: {
        displayName: 'Alex',
        startingWeightKg: 92.5,
        targetWeightKg: 80,
      },
      success: true,
    })
    expect(
      validateInviteAcceptance({
        displayName: '',
        startingWeightKg: 0,
        targetWeightKg: Number.NaN,
      }),
    ).toMatchObject({ success: false })
  })
})

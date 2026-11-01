import { describe, expect, it } from 'vitest'
import {
  groupMemberProgressForKey,
  valueForContext,
} from './groupMemberProgress'

describe('challenge-keyed group UI snapshots', () => {
  it('hides old member rows synchronously while a new challenge loads or is denied', () => {
    const prior = {
      key: 'account-a:group-a',
      rows: [
        {
          memberKey: 'private-old-row',
          displayName: 'Old group member',
          startingWeightKg: 100,
          targetWeightKg: 80,
          completionPercentage: 50,
          signedDisplayPercentage: 50,
          negativeProgressCapped: false,
          progressState: 'in_progress' as const,
          reachedTargetMilestones: [],
        },
      ],
      state: 'ready' as const,
    }
    expect(groupMemberProgressForKey(prior, 'account-b:group-a')).toEqual({
      key: 'account-b:group-a',
      rows: [],
      state: 'loading',
    })
    expect(groupMemberProgressForKey(prior, 'account-a:group-b').rows).toEqual(
      [],
    )
  })

  it('keeps clean or dirty dialogs inaccessible after context or eligibility changes', () => {
    const priorDialog = {
      contextKey: 'account-a:group-a:participant-a',
      value: { challengeId: 'group-a', targetWeightKg: 80 },
    }
    expect(
      valueForContext(priorDialog, 'account-a:group-b:participant-b', true),
    ).toBeNull()
    expect(
      valueForContext(priorDialog, 'account-a:group-a:participant-a', false),
    ).toBeNull()
    expect(
      valueForContext(priorDialog, 'account-b:group-a:participant-a', true),
    ).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { createChallengeFixture, createParticipantFixture } from './fixtures'
import { ownDashboardGoal } from './ownDashboardGoal'
import type { PersonalWeighIn } from './personalWeighIn'

const challenge = createChallengeFixture({ kind: 'group' })
const member = createParticipantFixture({
  startingWeightKg: 100,
  targetWeightKg: 90,
  joinedAt: '2026-10-01T12:00:00Z',
})
const entry = (
  date: string,
  weightKg: number,
  sharedChallengeIds = [challenge.id],
): PersonalWeighIn => ({ id: date, date, weightKg, sharedChallengeIds })
const goal = (entries: PersonalWeighIn[], participant = member) =>
  ownDashboardGoal(challenge, participant, member.userId, entries, '2026-10-12')

describe('own Dashboard goal evidence', () => {
  it('keeps private, other-group, pre-enrollment and future records out of the selected group goal', () => {
    const result = goal([
      entry('2026-09-30', 70),
      entry('2026-10-01', 94.8),
      entry('2026-10-10', 60, []),
      entry('2026-10-11', 50, ['other-group']),
      entry('2026-10-13', 40),
    ])!
    expect(result.dashboard.currentWeightKg).toBe(94.8)
    expect(result.dashboard.completionPercentage).toBeCloseTo(52)
    expect(result.dashboard.remainingTargetWeightKg).toBeCloseTo(4.8)
    expect(result.reached).toBe(false)
  })
  it('retains reached-target restrictions even if the latest shared entry rebounds', () => {
    const result = goal([entry('2026-10-02', 89), entry('2026-10-03', 94)])!
    expect(result.reached).toBe(true)
    expect(result.dashboard.completionPercentage).toBe(60)
  })
  it('allows a target increase while latest shared weight is above target, but keeps historical reach sticky', () => {
    const participant = { ...member, targetWeightKg: 80 }
    const at90 = goal([entry('2026-10-02', 90)], participant)!
    expect(at90.reached).toBe(false)
    const increaseTo85Allowed =
      85 < participant.startingWeightKg &&
      (!at90.reached || 85 < participant.targetWeightKg)
    expect(increaseTo85Allowed).toBe(true)

    const reachedThenRebounded = goal(
      [entry('2026-10-02', 80), entry('2026-10-03', 90)],
      participant,
    )!
    expect(reachedThenRebounded.reached).toBe(true)
    const increaseTo85AfterReachAllowed =
      85 < participant.startingWeightKg &&
      (!reachedThenRebounded.reached || 85 < participant.targetWeightKg)
    expect(increaseTo85AfterReachAllowed).toBe(false)
  })
  it('represents an equal-baseline target as reached without inventing an entry', () => {
    const result = goal([], { ...member, targetWeightKg: 100 })!
    expect(result.dashboard.completionPercentage).toBe(100)
    expect(result.dashboard.latestWeighIn).toBeNull()
    expect(result.reached).toBe(true)
  })
  it('marks above-baseline targets unavailable', () => {
    const result = goal([entry('2026-10-02', 95)], {
      ...member,
      targetWeightKg: 105,
    })!
    expect(result.invalidTarget).toBe(true)
    expect(result.dashboard.completionPercentage).toBeNull()
  })
  it.each([
    { ...member, userId: 'other-user' },
    { ...member, challengeId: 'other-group' },
    { ...member, status: 'withdrawn' as const },
  ])('rejects another author, group or inactive membership', (participant) => {
    expect(goal([], participant)).toBeNull()
  })
})

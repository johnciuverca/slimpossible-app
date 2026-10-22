import type { Challenge } from './challenge'
import type { Participant } from './participant'

// Setup-created groups remain draft until a challenge lifecycle is introduced.
// Membership activity and challenge lifecycle are separate authorization checks.
export function isEligibleSharingGroup(
  challenge: Challenge,
  userId: string,
  participants: Participant[],
) {
  return (
    challenge.kind === 'group' &&
    (challenge.status === 'draft' || challenge.status === 'active') &&
    (challenge.ownerId === userId ||
      participants.some(
        (participant) =>
          participant.userId === userId &&
          participant.challengeId === challenge.id &&
          participant.status === 'active',
      ))
  )
}

import type { Challenge } from './challenge'
import type { Participant } from './participant'

// Dashboard goals are owner-private personal contexts; sharing groups are separate.
export function personalGoalChoices(
  userId: string,
  challenges: readonly Challenge[],
  participants: readonly Participant[],
) {
  return challenges.filter(
    (challenge) =>
      challenge.kind === 'personal' &&
      challenge.ownerId === userId &&
      participants.some(
        (member) =>
          member.challengeId === challenge.id &&
          member.userId === userId &&
          member.status === 'active',
      ),
  )
}

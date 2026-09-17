import type { Challenge } from './challenge'
import type { Participant } from './participant'

export const challengeFixture: Challenge = {
  createdAt: '2026-09-15T08:00:00.000Z',
  createdBy: 'user-owner',
  description: 'A shared sustainable progress challenge.',
  endDate: '2027-09-15',
  id: 'challenge-1',
  name: 'Slimpossible 2026',
  ownerId: 'user-owner',
  startDate: '2026-09-15',
  status: 'draft',
  targetWeightKg: 80.5,
  updatedAt: '2026-09-15T08:00:00.000Z',
}

export const participantFixture: Participant = {
  challengeId: 'challenge-1',
  displayName: 'Alex Participant',
  id: 'participant-1',
  joinedAt: '2026-09-15T08:00:00.000Z',
  status: 'active',
  startingWeightKg: 92.5,
  targetWeightKg: 80,
  userId: 'user-alex',
}

export function createChallengeFixture(
  overrides: Partial<Challenge> = {},
): Challenge {
  return { ...challengeFixture, ...overrides }
}

export function createParticipantFixture(
  overrides: Partial<Participant> = {},
): Participant {
  return { ...participantFixture, ...overrides }
}

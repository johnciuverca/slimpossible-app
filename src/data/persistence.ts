import type { AuthState } from '../auth/context'
import {
  createSupabaseBrowserClient,
  type SupabaseEnvironment,
} from './supabase/client'
import type { Challenge } from '../models/challenge'
import type { Participant } from '../models/participant'
import type {
  ChallengeRepository,
  ChallengeWriteInput,
  ParticipantRepository,
  ParticipantWriteInput,
  RepositoryListResult,
  RepositoryResult,
  Repositories,
} from './supabase/repositories'
import { createRepositories } from './supabase/repositories'

export const remotePersistenceUnavailableMessage =
  'Remote persistence is unavailable until a Supabase session is signed in.'

export type ChallengeParticipantRepositories = Pick<
  Repositories,
  'challenges' | 'participants'
>

export type Persistence =
  | {
      mode: 'local' | 'remote'
      repositories: ChallengeParticipantRepositories
    }
  | {
      message: string
      mode: 'unavailable'
    }

const challengesStorageKey = 'slimpossible.local.challenges'
const participantsStorageKey = 'slimpossible.local.participants'

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readList<T>(storage: Storage, key: string): T[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    return Array.isArray(value) ? (value as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(storage: Storage, key: string, values: T[]) {
  try {
    storage.setItem(key, JSON.stringify(values))
    return true
  } catch {
    return false
  }
}

function localStorageError() {
  return {
    error: {
      kind: 'request' as const,
      message: 'Unable to save the local preview in this browser.',
    },
    state: 'error' as const,
  }
}

function createLocalRepositories(
  storage: Storage,
): ChallengeParticipantRepositories {
  const challenges: ChallengeRepository = {
    async create(input: ChallengeWriteInput) {
      const now = new Date().toISOString()
      const challenge: Challenge = {
        createdAt: now,
        createdBy: input.createdBy,
        ...(input.description ? { description: input.description } : {}),
        endDate: input.endDate,
        id: createLocalId('challenge'),
        name: input.name,
        ownerId: input.ownerId,
        startDate: input.startDate,
        status: input.status ?? 'draft',
        ...(input.targetWeightKg === undefined
          ? {}
          : { targetWeightKg: input.targetWeightKg }),
        updatedAt: now,
      }
      const values = readList<Challenge>(storage, challengesStorageKey)
      if (!writeList(storage, challengesStorageKey, [challenge, ...values])) {
        return localStorageError()
      }
      return { data: challenge, state: 'success' }
    },
    async findOwnedById(id: string) {
      const challenge = readList<Challenge>(storage, challengesStorageKey).find(
        (value) => value.id === id,
      )
      return challenge
        ? { data: challenge, state: 'success' }
        : { data: null, state: 'empty' }
    },
    async listOwned() {
      const values = readList<Challenge>(storage, challengesStorageKey)
      return values.length > 0
        ? { data: values, state: 'success' }
        : { data: [], state: 'empty' }
    },
    async update(id: string, input: ChallengeWriteInput) {
      const values = readList<Challenge>(storage, challengesStorageKey)
      const index = values.findIndex((value) => value.id === id)
      if (index < 0) {
        return { data: null, state: 'empty' }
      }

      const current = values[index]
      const challenge: Challenge = {
        ...current,
        createdBy: input.createdBy,
        ...(input.description ? { description: input.description } : {}),
        endDate: input.endDate,
        name: input.name,
        ownerId: input.ownerId,
        startDate: input.startDate,
        status: input.status ?? current.status,
        ...(input.targetWeightKg === undefined
          ? { targetWeightKg: undefined }
          : { targetWeightKg: input.targetWeightKg }),
        updatedAt: new Date().toISOString(),
      }
      values[index] = challenge
      if (!writeList(storage, challengesStorageKey, values)) {
        return localStorageError()
      }
      return { data: challenge, state: 'success' }
    },
  }

  const participants: ParticipantRepository = {
    async create(input: ParticipantWriteInput) {
      const participant: Participant = {
        challengeId: input.challengeId,
        displayName: input.displayName,
        id: createLocalId('participant'),
        ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
        status: input.status ?? 'invited',
        startingWeightKg: input.startingWeightKg,
        targetWeightKg: input.targetWeightKg,
        userId: input.userId,
      }
      const values = readList<Participant>(storage, participantsStorageKey)
      if (
        !writeList(storage, participantsStorageKey, [participant, ...values])
      ) {
        return localStorageError()
      }
      return { data: participant, state: 'success' }
    },
    async listForChallenge(challengeId: string) {
      const values = readList<Participant>(
        storage,
        participantsStorageKey,
      ).filter((value) => value.challengeId === challengeId)
      return values.length > 0
        ? { data: values, state: 'success' }
        : { data: [], state: 'empty' }
    },
    async update(id: string, input: ParticipantWriteInput) {
      const values = readList<Participant>(storage, participantsStorageKey)
      const index = values.findIndex((value) => value.id === id)
      if (index < 0) {
        return { data: null, state: 'empty' }
      }

      const participant: Participant = {
        ...values[index],
        challengeId: input.challengeId,
        displayName: input.displayName,
        ...(input.joinedAt ? { joinedAt: input.joinedAt } : {}),
        status: input.status ?? values[index].status,
        startingWeightKg: input.startingWeightKg,
        targetWeightKg: input.targetWeightKg,
        userId: input.userId,
      }
      values[index] = participant
      if (!writeList(storage, participantsStorageKey, values)) {
        return localStorageError()
      }
      return { data: participant, state: 'success' }
    },
  }

  return { challenges, participants }
}

export function createPersistence(
  authState: AuthState,
  storage: Storage = window.localStorage,
  environment?: SupabaseEnvironment,
): Persistence {
  const clientResult = createSupabaseBrowserClient(environment)

  if (clientResult.state === 'missing-configuration') {
    return { mode: 'local', repositories: createLocalRepositories(storage) }
  }

  if (
    clientResult.state !== 'configured' ||
    authState.status !== 'signed-in' ||
    !authState.user.id
  ) {
    return { message: remotePersistenceUnavailableMessage, mode: 'unavailable' }
  }

  return {
    mode: 'remote',
    repositories: createRepositories(clientResult.client),
  }
}

export type { RepositoryListResult, RepositoryResult }

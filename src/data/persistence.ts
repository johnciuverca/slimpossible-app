import type { AuthState } from '../auth/context'
import {
  createSupabaseBrowserClient,
  type SupabaseEnvironment,
} from './supabase/client'
import type { Challenge } from '../models/challenge'
import type { Participant } from '../models/participant'
import {
  getChallengeInviteStatus,
  type ChallengeInvite,
  type ChallengeInvitePreview,
} from '../models/challengeInvite'
import type { WeighIn } from '../models/weighIn'
import type {
  ChallengeRepository,
  ChallengeInviteRepository,
  CreatedChallengeInvite,
  ChallengeWriteInput,
  GroupProgressRepository,
  ParticipantRepository,
  ParticipantWriteInput,
  RepositoryListResult,
  RepositoryResult,
  Repositories,
  ProfileRepository,
  WeighInRepository,
  WeighInWriteInput,
} from './supabase/repositories'
import { createRepositories } from './supabase/repositories'

export const remotePersistenceUnavailableMessage =
  'Remote persistence is unavailable until a Supabase session is signed in.'

export type PersistenceRepositories = Pick<
  Repositories,
  | 'challenges'
  | 'groupProgress'
  | 'invites'
  | 'participants'
  | 'profiles'
  | 'weighIns'
>

export type ChallengeParticipantRepositories = Pick<
  Repositories,
  'challenges' | 'participants'
>

export type Persistence =
  | {
      mode: 'local' | 'remote'
      repositories: PersistenceRepositories
    }
  | {
      message: string
      mode: 'unavailable'
    }

export type InvitePersistence =
  | {
      mode: 'local' | 'remote'
      repositories: Pick<Repositories, 'invites'>
    }
  | {
      message: string
      mode: 'unavailable'
    }

const challengesStorageKey = 'slimpossible.local.challenges'
const participantsStorageKey = 'slimpossible.local.participants'
const weighInsStorageKey = 'slimpossible.local.weigh-ins'
const invitesStorageKey = 'slimpossible.local.challenge-invites'

type LocalChallengeInvite = ChallengeInvite & { token: string }

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

function createLocalRepositories(storage: Storage): PersistenceRepositories {
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
    async findOwnedById(id: string, ownerId: string) {
      const challenge = readList<Challenge>(storage, challengesStorageKey).find(
        (value) => value.id === id && value.ownerId === ownerId,
      )
      return challenge
        ? { data: challenge, state: 'success' }
        : { data: null, state: 'empty' }
    },
    async listOwned(ownerId?: string) {
      const values = readList<Challenge>(storage, challengesStorageKey).filter(
        (value) => !ownerId || value.ownerId === ownerId,
      )
      return values.length > 0
        ? { data: values, state: 'success' }
        : { data: [], state: 'empty' }
    },
    async listVisibleToUser(userId: string) {
      const joinedChallengeIds = new Set(
        readList<Participant>(storage, participantsStorageKey)
          .filter(
            (participant) =>
              participant.userId === userId && participant.status === 'active',
          )
          .map((participant) => participant.challengeId),
      )
      const values = readList<Challenge>(storage, challengesStorageKey).filter(
        (challenge) =>
          challenge.ownerId === userId || joinedChallengeIds.has(challenge.id),
      )
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
          ? {}
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
    async listForUser(userId: string) {
      const values = readList<Participant>(
        storage,
        participantsStorageKey,
      ).filter((value) => value.userId === userId)
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

  const invites: ChallengeInviteRepository = {
    async accept(token, input, localUserId) {
      if (!localUserId) {
        return {
          error: {
            kind: 'request',
            message: 'Sign in before accepting an invitation.',
          },
          state: 'error',
        }
      }

      const invite = readList<LocalChallengeInvite>(
        storage,
        invitesStorageKey,
      ).find((value) => value.token === token)
      if (!invite) {
        return {
          error: { kind: 'request', message: 'This invitation is invalid.' },
          state: 'error',
        }
      }

      const status = getChallengeInviteStatus(invite)
      if (status === 'revoked') {
        return {
          error: {
            kind: 'request',
            message: 'This invitation has been revoked.',
          },
          state: 'error',
        }
      }
      if (status === 'expired') {
        return {
          error: { kind: 'request', message: 'This invitation has expired.' },
          state: 'error',
        }
      }

      const values = readList<Participant>(storage, participantsStorageKey)
      const existing = values.find(
        (value) =>
          value.challengeId === invite.challengeId &&
          value.userId === localUserId,
      )
      if (existing) return { data: existing, state: 'success' }

      const participant: Participant = {
        challengeId: invite.challengeId,
        displayName: input.displayName,
        id: createLocalId('participant'),
        joinedAt: new Date().toISOString(),
        status: 'active',
        startingWeightKg: input.startingWeightKg,
        targetWeightKg: input.targetWeightKg,
        userId: localUserId,
      }
      if (
        !writeList(storage, participantsStorageKey, [participant, ...values])
      ) {
        return localStorageError()
      }
      return { data: participant, state: 'success' }
    },
    async create(challengeId, expiresAt) {
      const now = new Date().toISOString()
      const invite: LocalChallengeInvite = {
        challengeId,
        createdAt: now,
        expiresAt,
        id: createLocalId('invite'),
        token: createLocalId('invite-token'),
      }
      const values = readList<LocalChallengeInvite>(storage, invitesStorageKey)
      if (!writeList(storage, invitesStorageKey, [invite, ...values])) {
        return localStorageError()
      }
      const result: CreatedChallengeInvite = {
        invite: {
          challengeId: invite.challengeId,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          id: invite.id,
        },
        token: invite.token,
      }
      return { data: result, state: 'success' }
    },
    async listForChallenge(challengeId) {
      const values = readList<LocalChallengeInvite>(storage, invitesStorageKey)
        .filter((value) => value.challengeId === challengeId)
        .map(({ challengeId, createdAt, expiresAt, id, revokedAt }) => ({
          challengeId,
          createdAt,
          expiresAt,
          id,
          ...(revokedAt ? { revokedAt } : {}),
        }))
      return values.length > 0
        ? { data: values, state: 'success' }
        : { data: [], state: 'empty' }
    },
    async preview(token) {
      const invite = readList<LocalChallengeInvite>(
        storage,
        invitesStorageKey,
      ).find((value) => value.token === token)
      if (!invite) {
        return { data: null, state: 'empty' }
      }

      const challenge = readList<Challenge>(storage, challengesStorageKey).find(
        (value) => value.id === invite.challengeId,
      )
      if (!challenge) return { data: null, state: 'empty' }

      const preview: ChallengeInvitePreview = {
        challengeId: invite.challengeId,
        challengeName: challenge.name,
        expiresAt: invite.expiresAt,
        id: invite.id,
        ...(invite.revokedAt ? { revokedAt: invite.revokedAt } : {}),
        status: getChallengeInviteStatus(invite),
      }
      return { data: preview, state: 'success' }
    },
    async revoke(id) {
      const values = readList<LocalChallengeInvite>(storage, invitesStorageKey)
      const index = values.findIndex((value) => value.id === id)
      if (index < 0) return { data: null, state: 'empty' }
      values[index] = { ...values[index], revokedAt: new Date().toISOString() }
      if (!writeList(storage, invitesStorageKey, values)) {
        return localStorageError()
      }
      return { data: true, state: 'success' }
    },
  }

  const weighIns: WeighInRepository = {
    async create(input: WeighInWriteInput) {
      const weighIn: WeighIn = {
        date: input.date,
        ...(input.note ? { note: input.note } : {}),
        participantId: input.participantId,
        weightKg: input.weightKg,
      }
      const values = readList<WeighIn>(storage, weighInsStorageKey)
      if (!writeList(storage, weighInsStorageKey, [weighIn, ...values])) {
        return localStorageError()
      }
      return { data: weighIn, state: 'success' }
    },
    async listForParticipant(participantId: string) {
      const values = readList<WeighIn>(storage, weighInsStorageKey).filter(
        (value) => value.participantId === participantId,
      )
      return values.length > 0
        ? { data: values, state: 'success' }
        : { data: [], state: 'empty' }
    },
    async update(id: string, input: WeighInWriteInput) {
      const values = readList<WeighIn>(storage, weighInsStorageKey)
      const index = values.findIndex(
        (value) => `${value.participantId}-${value.date}` === id,
      )
      if (index < 0) {
        return { data: null, state: 'empty' }
      }

      const weighIn: WeighIn = {
        date: input.date,
        ...(input.note ? { note: input.note } : {}),
        participantId: input.participantId,
        weightKg: input.weightKg,
      }
      values[index] = weighIn
      if (!writeList(storage, weighInsStorageKey, values)) {
        return localStorageError()
      }
      return { data: weighIn, state: 'success' }
    },
    async upsert(input: WeighInWriteInput) {
      const values = readList<WeighIn>(storage, weighInsStorageKey)
      const index = values.findIndex(
        (value) =>
          value.participantId === input.participantId &&
          value.date === input.date,
      )
      const weighIn: WeighIn = {
        date: input.date,
        ...(input.note ? { note: input.note } : {}),
        participantId: input.participantId,
        weightKg: input.weightKg,
      }

      if (index < 0) {
        values.unshift(weighIn)
      } else {
        values[index] = weighIn
      }
      if (!writeList(storage, weighInsStorageKey, values)) {
        return localStorageError()
      }
      return { data: weighIn, state: 'success' }
    },
  }

  const profiles: ProfileRepository = {
    async ensure(input) {
      return {
        data: { displayName: input.displayName, id: input.id },
        state: 'success',
      }
    },
  }

  const groupProgress: GroupProgressRepository = {
    async getForChallenge() {
      return {
        error: {
          kind: 'request',
          message: 'Shared group progress requires a signed-in server session.',
        },
        state: 'error',
      }
    },
    async getProvisionalLeader() {
      return {
        error: {
          kind: 'request',
          message: 'Shared group progress requires a signed-in server session.',
        },
        state: 'error',
      }
    },
  }

  return {
    challenges,
    groupProgress,
    invites,
    participants,
    profiles,
    weighIns,
  }
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

/**
 * Invite previews are safe to load before authentication. Acceptance and all
 * owner actions remain authorized by Supabase RPCs using auth.uid().
 */
export function createInvitePersistence(
  authState: AuthState,
  storage: Storage = window.localStorage,
  environment?: SupabaseEnvironment,
): InvitePersistence {
  const clientResult = createSupabaseBrowserClient(environment)

  if (clientResult.state === 'missing-configuration') {
    return {
      mode: 'local',
      repositories: {
        invites: createLocalRepositories(storage).invites,
      },
    }
  }

  if (clientResult.state !== 'configured') {
    return { message: clientResult.message, mode: 'unavailable' }
  }

  void authState
  return {
    mode: 'remote',
    repositories: { invites: createRepositories(clientResult.client).invites },
  }
}

export type { RepositoryListResult, RepositoryResult }

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Challenge } from '../../models/challenge'
import type { Participant } from '../../models/participant'
import type {
  ChallengeInvite,
  ChallengeInvitePreview,
  InviteAcceptanceValues,
} from '../../models/challengeInvite'
import type { WeighIn } from '../../models/weighIn'
import type { GroupProgressSummary } from '../../models/groupProgress'
import type { Database } from './database.types'

export type RepositoryError = {
  code?: string
  kind: 'mapping' | 'request'
  message: string
}

export type RepositoryResult<T> =
  | { data: T; state: 'success' }
  | { data: null; state: 'empty' }
  | { error: RepositoryError; state: 'error' }

export type RepositoryListResult<T> =
  | { data: T[]; state: 'success' }
  | { data: []; state: 'empty' }
  | { error: RepositoryError; state: 'error' }

type DatabaseClient = SupabaseClient<Database>
type ChallengeRow = Database['public']['Tables']['challenges']['Row']
type ParticipantRow = Database['public']['Tables']['participants']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type WeighInRow = Database['public']['Tables']['weigh_ins']['Row']
type ChallengeInviteRow =
  Database['public']['Functions']['list_challenge_invites']['Returns'][number]
type ChallengeInvitePreviewRow =
  Database['public']['Functions']['preview_challenge_invite']['Returns'][number]
type CreatedChallengeInviteRow =
  Database['public']['Functions']['create_challenge_invite']['Returns'][number]
type GroupProgressRow =
  Database['public']['Functions']['get_group_progress_summary']['Returns'][number]

export type ChallengeRepository = {
  create: (input: ChallengeWriteInput) => Promise<RepositoryResult<Challenge>>
  findOwnedById: (
    id: string,
    ownerId: string,
  ) => Promise<RepositoryResult<Challenge>>
  listOwned: (
    ownerId?: string,
    options?: { signal?: AbortSignal },
  ) => Promise<RepositoryListResult<Challenge>>
  listVisibleToUser: (
    userId: string,
    options?: { signal?: AbortSignal },
  ) => Promise<RepositoryListResult<Challenge>>
  update: (
    id: string,
    input: ChallengeWriteInput,
  ) => Promise<RepositoryResult<Challenge>>
}

export type ParticipantRepository = {
  create: (
    input: ParticipantWriteInput,
  ) => Promise<RepositoryResult<Participant>>
  listForChallenge: (
    challengeId: string,
  ) => Promise<RepositoryListResult<Participant>>
  listForUser: (userId: string) => Promise<RepositoryListResult<Participant>>
  update: (
    id: string,
    input: ParticipantWriteInput,
  ) => Promise<RepositoryResult<Participant>>
}

export type Profile = {
  displayName: string
  id: string
}

export type ProfileRepository = {
  ensure: (input: {
    displayName: string
    id: string
  }) => Promise<RepositoryResult<Profile>>
}

export type WeighInRepository = {
  create: (input: WeighInWriteInput) => Promise<RepositoryResult<WeighIn>>
  listForParticipant: (
    participantId: string,
  ) => Promise<RepositoryListResult<WeighIn>>
  update: (
    id: string,
    input: WeighInWriteInput,
  ) => Promise<RepositoryResult<WeighIn>>
  upsert: (input: WeighInWriteInput) => Promise<RepositoryResult<WeighIn>>
}

export type GroupProgressRepository = {
  getForChallenge: (
    challengeId: string,
    currentSunday: string,
  ) => Promise<RepositoryResult<GroupProgressSummary>>
}

export type CreatedChallengeInvite = {
  invite: ChallengeInvite
  token: string
}

export type ChallengeInviteRepository = {
  accept: (
    token: string,
    input: InviteAcceptanceValues,
    localUserId?: string,
  ) => Promise<RepositoryResult<Participant>>
  create: (
    challengeId: string,
    expiresAt: string,
  ) => Promise<RepositoryResult<CreatedChallengeInvite>>
  listForChallenge: (
    challengeId: string,
  ) => Promise<RepositoryListResult<ChallengeInvite>>
  preview: (token: string) => Promise<RepositoryResult<ChallengeInvitePreview>>
  revoke: (id: string) => Promise<RepositoryResult<boolean>>
}

export type Repositories = {
  challenges: ChallengeRepository
  groupProgress: GroupProgressRepository
  participants: ParticipantRepository
  profiles: ProfileRepository
  invites: ChallengeInviteRepository
  weighIns: WeighInRepository
}

export type ChallengeWriteInput = {
  createdBy: string
  description?: string
  endDate: string
  name: string
  ownerId: string
  startDate: string
  status?: ChallengeRow['status']
  targetWeightKg?: number
}

export type ParticipantWriteInput = {
  challengeId: string
  displayName: string
  joinedAt?: string
  startingWeightKg: number
  status?: ParticipantRow['status']
  targetWeightKg: number
  userId: string
}

export type WeighInWriteInput = {
  date: string
  note?: string
  participantId: string
  weightKg: number
}

function requestError(operation: string, error: unknown): RepositoryError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined

  return {
    ...(code ? { code } : {}),
    kind: 'request',
    message: `Unable to ${operation}.`,
  }
}

function mappingError(entity: string): RepositoryError {
  return {
    kind: 'mapping',
    message: `The ${entity} response was invalid.`,
  }
}

function mapChallenge(row: ChallengeRow): Challenge {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    ...(row.description === null ? {} : { description: row.description }),
    endDate: row.end_date,
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    startDate: row.start_date,
    status: row.status,
    ...(row.target_weight_kg === null
      ? {}
      : { targetWeightKg: row.target_weight_kg }),
    updatedAt: row.updated_at,
  }
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    challengeId: row.challenge_id,
    displayName: row.display_name,
    id: row.id,
    ...(row.joined_at === null ? {} : { joinedAt: row.joined_at }),
    status: row.status,
    startingWeightKg: row.starting_weight_kg,
    targetWeightKg: row.target_weight_kg,
    userId: row.user_id,
  }
}

function mapProfile(row: ProfileRow): Profile {
  return { displayName: row.display_name, id: row.id }
}

function mapWeighIn(row: WeighInRow): WeighIn {
  return {
    date: row.recorded_date,
    ...(row.note === null ? {} : { note: row.note }),
    participantId: row.participant_id,
    weightKg: row.weight_kg,
  }
}

function mapChallengeInvite(row: ChallengeInviteRow): ChallengeInvite {
  return {
    challengeId: row.challenge_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.invite_id,
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  }
}

function mapChallengeInvitePreview(
  row: ChallengeInvitePreviewRow,
): ChallengeInvitePreview {
  if (
    row.status !== 'active' &&
    row.status !== 'expired' &&
    row.status !== 'revoked'
  ) {
    throw new Error('Invalid invitation status')
  }

  return {
    challengeId: row.challenge_id,
    challengeName: row.challenge_name,
    expiresAt: row.expires_at,
    id: row.invite_id,
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
    status: row.status,
  }
}

function mapGroupProgress(row: GroupProgressRow): GroupProgressSummary {
  const counts = [
    row.active_participant_count,
    row.participants_with_recorded_weight_count,
    row.participants_with_progress_count,
    row.reached_target_count,
    row.eligible_participant_count,
    row.weekly_winner_count,
  ]
  if (
    typeof row.challenge_id !== 'string' ||
    typeof row.current_sunday !== 'string' ||
    typeof row.previous_sunday !== 'string' ||
    counts.some((count) => !Number.isInteger(count) || count < 0) ||
    (row.average_completion_percentage !== null &&
      (!Number.isFinite(row.average_completion_percentage) ||
        row.average_completion_percentage < 0 ||
        row.average_completion_percentage > 100)) ||
    !Array.isArray(row.weekly_winner_names) ||
    row.weekly_winner_names.some((name) => typeof name !== 'string') ||
    row.weekly_winner_count !== row.weekly_winner_names.length
  ) {
    throw new Error('Invalid group progress response')
  }

  return {
    activeParticipantCount: row.active_participant_count,
    averageCompletionPercentage: row.average_completion_percentage,
    challengeId: row.challenge_id,
    currentSunday: row.current_sunday,
    eligibleParticipantCount: row.eligible_participant_count,
    participantsWithProgressCount: row.participants_with_progress_count,
    participantsWithRecordedWeightCount:
      row.participants_with_recorded_weight_count,
    previousSunday: row.previous_sunday,
    reachedTargetCount: row.reached_target_count,
    weeklyWinnerCount: row.weekly_winner_count,
    weeklyWinnerNames: [...row.weekly_winner_names],
  }
}

function inviteRequestError(
  operation: string,
  error: unknown,
): RepositoryError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined
  const messages: Record<string, string> = {
    P0002: 'This invitation has been revoked.',
    P0003: 'This invitation has expired.',
    P0004: 'This invitation is invalid.',
  }

  return {
    ...(code ? { code } : {}),
    kind: 'request',
    message:
      code && messages[code] ? messages[code] : `Unable to ${operation}.`,
  }
}

function mapList<TDatabase, TDomain>(
  rows: TDatabase[] | null,
  map: (row: TDatabase) => TDomain,
  entity: string,
): RepositoryListResult<TDomain> {
  if (rows === null) {
    return { data: [], state: 'empty' }
  }

  try {
    const data = rows.map(map)
    return data.length === 0
      ? { data: [], state: 'empty' }
      : { data, state: 'success' }
  } catch {
    return { error: mappingError(entity), state: 'error' }
  }
}

function mapSingle<TDatabase, TDomain>(
  row: TDatabase | null,
  map: (row: TDatabase) => TDomain,
  entity: string,
): RepositoryResult<TDomain> {
  if (row === null) {
    return { data: null, state: 'empty' }
  }

  try {
    return { data: map(row), state: 'success' }
  } catch {
    return { error: mappingError(entity), state: 'error' }
  }
}

export function createRepositories(client: DatabaseClient): Repositories {
  return {
    challenges: {
      async create(input) {
        const { data, error } = await client
          .from('challenges')
          .insert({
            created_by: input.createdBy,
            description: input.description ?? null,
            end_date: input.endDate,
            name: input.name,
            owner_id: input.ownerId,
            start_date: input.startDate,
            ...(input.status ? { status: input.status } : {}),
            ...(input.targetWeightKg === undefined
              ? {}
              : { target_weight_kg: input.targetWeightKg }),
          })
          .select('*')
          .single()

        return error
          ? { error: requestError('save the challenge', error), state: 'error' }
          : mapSingle(data, mapChallenge, 'challenge')
      },
      async findOwnedById(id, ownerId) {
        const { data, error } = await client
          .from('challenges')
          .select('*')
          .eq('id', id)
          .eq('owner_id', ownerId)
          .maybeSingle()

        return error
          ? { error: requestError('load the challenge', error), state: 'error' }
          : mapSingle(data, mapChallenge, 'challenge')
      },
      async listOwned(ownerId, options) {
        let query = client
          .from('challenges')
          .select('*')
          .order('created_at', { ascending: false })
        if (ownerId) query = query.eq('owner_id', ownerId)
        if (options?.signal) query = query.abortSignal(options.signal)
        const { data, error } = await query

        return error
          ? {
              error: requestError('load the challenges', error),
              state: 'error',
            }
          : mapList(data, mapChallenge, 'challenge')
      },
      async listVisibleToUser(_userId, options) {
        // Challenge RLS scopes this query to auth.uid()'s owned or joined rows.
        let query = client
          .from('challenges')
          .select('*')
          .order('created_at', { ascending: false })
        if (options?.signal) query = query.abortSignal(options.signal)
        const { data, error } = await query

        return error
          ? {
              error: requestError('load the challenges', error),
              state: 'error',
            }
          : mapList(data, mapChallenge, 'challenge')
      },
      async update(id, input) {
        const { data, error } = await client
          .from('challenges')
          .update({
            created_by: input.createdBy,
            description: input.description ?? null,
            end_date: input.endDate,
            name: input.name,
            owner_id: input.ownerId,
            start_date: input.startDate,
            ...(input.status ? { status: input.status } : {}),
            ...(input.targetWeightKg === undefined
              ? {}
              : { target_weight_kg: input.targetWeightKg }),
          })
          .eq('id', id)
          .eq('owner_id', input.ownerId)
          .select('*')
          .maybeSingle()

        return error
          ? {
              error: requestError('update the challenge', error),
              state: 'error',
            }
          : mapSingle(data, mapChallenge, 'challenge')
      },
    },
    groupProgress: {
      async getForChallenge(challengeId, currentSunday) {
        const { data, error } = await client.rpc('get_group_progress_summary', {
          target_challenge_id: challengeId,
          target_current_sunday: currentSunday,
        })

        if (error) {
          return {
            error: requestError('load shared group progress', error),
            state: 'error',
          }
        }

        const result = mapSingle(
          data?.[0] ?? null,
          mapGroupProgress,
          'shared group progress',
        )
        if (
          result.state === 'success' &&
          (result.data.challengeId !== challengeId ||
            result.data.currentSunday !== currentSunday)
        ) {
          return {
            error: mappingError('shared group progress'),
            state: 'error',
          }
        }
        return result
      },
    },
    participants: {
      async create(input) {
        const { data, error } = await client
          .from('participants')
          .insert({
            challenge_id: input.challengeId,
            display_name: input.displayName,
            joined_at: input.joinedAt ?? null,
            starting_weight_kg: input.startingWeightKg,
            ...(input.status ? { status: input.status } : {}),
            target_weight_kg: input.targetWeightKg,
            user_id: input.userId,
          })
          .select('*')
          .single()

        return error
          ? {
              error: requestError('save the participant', error),
              state: 'error',
            }
          : mapSingle(data, mapParticipant, 'participant')
      },
      async listForChallenge(challengeId) {
        const { data, error } = await client
          .from('participants')
          .select('*')
          .eq('challenge_id', challengeId)
          .order('created_at', { ascending: true })

        return error
          ? {
              error: requestError('load the participants', error),
              state: 'error',
            }
          : mapList(data, mapParticipant, 'participant')
      },
      async listForUser(userId) {
        const { data, error } = await client
          .from('participants')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        return error
          ? {
              error: requestError('load the participants', error),
              state: 'error',
            }
          : mapList(data, mapParticipant, 'participant')
      },
      async update(id, input) {
        const { data, error } = await client
          .from('participants')
          .update({
            challenge_id: input.challengeId,
            display_name: input.displayName,
            joined_at: input.joinedAt ?? null,
            starting_weight_kg: input.startingWeightKg,
            ...(input.status ? { status: input.status } : {}),
            target_weight_kg: input.targetWeightKg,
            user_id: input.userId,
          })
          .eq('id', id)
          .select('*')
          .maybeSingle()

        return error
          ? {
              error: requestError('update the participant', error),
              state: 'error',
            }
          : mapSingle(data, mapParticipant, 'participant')
      },
    },
    profiles: {
      async ensure(input) {
        const existing = await client
          .from('profiles')
          .select('*')
          .eq('id', input.id)
          .maybeSingle()

        if (existing.error) {
          return {
            error: requestError('load the profile', existing.error),
            state: 'error',
          }
        }
        if (existing.data)
          return mapSingle(existing.data, mapProfile, 'profile')

        const { data, error } = await client
          .from('profiles')
          .insert({ id: input.id, display_name: input.displayName })
          .select('*')
          .single()

        if (error) {
          if (error.code === '23505') {
            const concurrent = await client
              .from('profiles')
              .select('*')
              .eq('id', input.id)
              .maybeSingle()

            if (!concurrent.error && concurrent.data) {
              return mapSingle(concurrent.data, mapProfile, 'profile')
            }
          }

          return {
            error: requestError('initialize the profile', error),
            state: 'error',
          }
        }

        return mapSingle(data, mapProfile, 'profile')
      },
    },
    invites: {
      async accept(token, input) {
        const { data, error } = await client.rpc('accept_challenge_invite', {
          invite_token: token,
          participant_display_name: input.displayName,
          participant_starting_weight_kg: input.startingWeightKg,
          participant_target_weight_kg: input.targetWeightKg,
        })

        return error
          ? {
              error: inviteRequestError('accept the invitation', error),
              state: 'error',
            }
          : mapSingle(data, mapParticipant, 'participant')
      },
      async create(challengeId, expiresAt) {
        const { data, error } = await client.rpc('create_challenge_invite', {
          target_challenge_id: challengeId,
          target_expires_at: expiresAt,
        })

        if (error) {
          return {
            error: inviteRequestError('create the invitation', error),
            state: 'error',
          }
        }

        const row: CreatedChallengeInviteRow | null = data?.[0] ?? null
        if (!row) return { data: null, state: 'empty' }

        return {
          data: {
            invite: {
              challengeId: row.challenge_id,
              createdAt: new Date().toISOString(),
              expiresAt: row.expires_at,
              id: row.invite_id,
            },
            token: row.token,
          },
          state: 'success',
        }
      },
      async listForChallenge(challengeId) {
        const { data, error } = await client.rpc('list_challenge_invites', {
          target_challenge_id: challengeId,
        })

        return error
          ? {
              error: inviteRequestError('load the invitations', error),
              state: 'error',
            }
          : mapList(data, mapChallengeInvite, 'invitation')
      },
      async preview(token) {
        const { data, error } = await client.rpc('preview_challenge_invite', {
          invite_token: token,
        })

        return error
          ? {
              error: inviteRequestError('load the invitation', error),
              state: 'error',
            }
          : mapSingle(
              data?.[0] ?? null,
              mapChallengeInvitePreview,
              'invitation',
            )
      },
      async revoke(id) {
        const { data, error } = await client.rpc('revoke_challenge_invite', {
          target_invite_id: id,
        })

        if (error) {
          return {
            error: inviteRequestError('revoke the invitation', error),
            state: 'error',
          }
        }

        return data
          ? { data: true, state: 'success' }
          : { data: null, state: 'empty' }
      },
    },
    weighIns: {
      async create(input) {
        const { data, error } = await client
          .from('weigh_ins')
          .insert({
            note: input.note ?? null,
            participant_id: input.participantId,
            recorded_date: input.date,
            weight_kg: input.weightKg,
          })
          .select('*')
          .single()

        return error
          ? { error: requestError('save the weigh-in', error), state: 'error' }
          : mapSingle(data, mapWeighIn, 'weigh-in')
      },
      async listForParticipant(participantId) {
        const { data, error } = await client
          .from('weigh_ins')
          .select('*')
          .eq('participant_id', participantId)
          .order('recorded_date', { ascending: false })

        return error
          ? {
              error: requestError('load the weigh-ins', error),
              state: 'error',
            }
          : mapList(data, mapWeighIn, 'weigh-in')
      },
      async update(id, input) {
        const { data, error } = await client
          .from('weigh_ins')
          .update({
            note: input.note ?? null,
            participant_id: input.participantId,
            recorded_date: input.date,
            weight_kg: input.weightKg,
          })
          .eq('id', id)
          .select('*')
          .maybeSingle()

        return error
          ? {
              error: requestError('update the weigh-in', error),
              state: 'error',
            }
          : mapSingle(data, mapWeighIn, 'weigh-in')
      },
      async upsert(input) {
        const { data, error } = await client
          .from('weigh_ins')
          .upsert(
            {
              note: input.note ?? null,
              participant_id: input.participantId,
              recorded_date: input.date,
              weight_kg: input.weightKg,
            },
            { onConflict: 'participant_id,recorded_date' },
          )
          .select('*')
          .single()

        return error
          ? { error: requestError('save the weigh-in', error), state: 'error' }
          : mapSingle(data, mapWeighIn, 'weigh-in')
      },
    },
  }
}

export { mapChallenge, mapParticipant, mapWeighIn }

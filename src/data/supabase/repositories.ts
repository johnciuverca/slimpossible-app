import type { SupabaseClient } from '@supabase/supabase-js'

import type { Challenge } from '../../models/challenge'
import type { Participant } from '../../models/participant'
import type { WeighIn } from '../../models/weighIn'
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
type WeighInRow = Database['public']['Tables']['weigh_ins']['Row']

export type ChallengeRepository = {
  findOwnedById: (id: string) => Promise<RepositoryResult<Challenge>>
  listOwned: () => Promise<RepositoryListResult<Challenge>>
}

export type ParticipantRepository = {
  listForChallenge: (
    challengeId: string,
  ) => Promise<RepositoryListResult<Participant>>
}

export type WeighInRepository = {
  listForParticipant: (
    participantId: string,
  ) => Promise<RepositoryListResult<WeighIn>>
}

export type Repositories = {
  challenges: ChallengeRepository
  participants: ParticipantRepository
  weighIns: WeighInRepository
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

function mapWeighIn(row: WeighInRow): WeighIn {
  return {
    date: row.recorded_date,
    ...(row.note === null ? {} : { note: row.note }),
    participantId: row.participant_id,
    weightKg: row.weight_kg,
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
      async findOwnedById(id) {
        const { data, error } = await client
          .from('challenges')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        return error
          ? { error: requestError('load the challenge', error), state: 'error' }
          : mapSingle(data, mapChallenge, 'challenge')
      },
      async listOwned() {
        const { data, error } = await client
          .from('challenges')
          .select('*')
          .order('created_at', { ascending: false })

        return error
          ? {
              error: requestError('load the challenges', error),
              state: 'error',
            }
          : mapList(data, mapChallenge, 'challenge')
      },
    },
    participants: {
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
    },
    weighIns: {
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
    },
  }
}

export { mapChallenge, mapParticipant, mapWeighIn }

import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Database } from './database.types'
import { createRepositories } from './repositories'

const client = createClient<Database>(
  'https://project.supabase.co',
  'public-anon-key',
)

function stubResponse(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
        status,
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Supabase repositories', () => {
  it('loads an existing profile without overwriting its display name', async () => {
    stubResponse({
      created_at: '2026-09-17T10:00:00.000Z',
      display_name: 'Existing participant name',
      id: 'user-1',
      updated_at: '2026-09-17T10:00:00.000Z',
    })

    const result = await createRepositories(client).profiles.ensure({
      displayName: 'New metadata name',
      id: 'user-1',
    })

    expect(result).toEqual({
      data: { displayName: 'Existing participant name', id: 'user-1' },
      state: 'success',
    })
  })

  it('inserts a profile when the authenticated user has no profile yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('null', { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              created_at: '2026-09-17T10:00:00.000Z',
              display_name: 'Participant',
              id: 'user-1',
              updated_at: '2026-09-17T10:00:00.000Z',
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 201 },
          ),
        ),
    )

    const result = await createRepositories(client).profiles.ensure({
      displayName: 'Participant',
      id: 'user-1',
    })

    expect(result).toEqual({
      data: { displayName: 'Participant', id: 'user-1' },
      state: 'success',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('preserves an existing profile display name during initialization', async () => {
    stubResponse({
      created_at: '2026-09-17T10:00:00.000Z',
      display_name: 'Existing name',
      id: 'user-1',
      updated_at: '2026-09-17T10:00:00.000Z',
    })

    const result = await createRepositories(client).profiles.ensure({
      displayName: 'Auth email fallback',
      id: 'user-1',
    })

    expect(result).toMatchObject({
      data: { displayName: 'Existing name', id: 'user-1' },
      state: 'success',
    })
  })

  it('creates and maps a challenge through the repository', async () => {
    stubResponse({
      created_at: '2026-09-17T10:00:00.000Z',
      created_by: 'owner-1',
      description: null,
      end_date: '2026-10-01',
      id: 'challenge-1',
      name: 'September challenge',
      owner_id: 'owner-1',
      start_date: '2026-09-17',
      status: 'draft',
      target_weight_kg: null,
      updated_at: '2026-09-17T10:00:00.000Z',
    })

    const result = await createRepositories(client).challenges.create({
      createdBy: 'owner-1',
      endDate: '2026-10-01',
      name: 'September challenge',
      ownerId: 'owner-1',
      startDate: '2026-09-17',
    })

    expect(result).toMatchObject({
      data: {
        id: 'challenge-1',
        name: 'September challenge',
        ownerId: 'owner-1',
      },
      state: 'success',
    })
  })

  it('maps a database challenge row to the domain shape', async () => {
    stubResponse([
      {
        created_at: '2026-09-17T10:00:00.000Z',
        created_by: 'creator-1',
        description: 'A focused challenge',
        end_date: '2026-10-01',
        id: 'challenge-1',
        name: 'September challenge',
        owner_id: 'owner-1',
        start_date: '2026-09-17',
        status: 'active',
        target_weight_kg: 80,
        updated_at: '2026-09-17T10:00:00.000Z',
      },
    ])

    const result = await createRepositories(client).challenges.listOwned()

    expect(result).toEqual({
      data: [
        {
          createdBy: 'creator-1',
          createdAt: '2026-09-17T10:00:00.000Z',
          description: 'A focused challenge',
          endDate: '2026-10-01',
          id: 'challenge-1',
          name: 'September challenge',
          ownerId: 'owner-1',
          startDate: '2026-09-17',
          status: 'active',
          targetWeightKg: 80,
          updatedAt: '2026-09-17T10:00:00.000Z',
        },
      ],
      state: 'success',
    })
  })

  it('returns an explicit empty state for an empty participant list', async () => {
    stubResponse([])

    const result =
      await createRepositories(client).participants.listForChallenge(
        'challenge-1',
      )

    expect(result).toEqual({ data: [], state: 'empty' })
  })

  it('updates and maps a participant through the repository', async () => {
    stubResponse({
      challenge_id: 'challenge-1',
      created_at: '2026-09-17T10:00:00.000Z',
      display_name: 'Alex Updated',
      id: 'participant-1',
      joined_at: '2026-09-17T10:00:00.000Z',
      starting_weight_kg: 92.5,
      status: 'active',
      target_weight_kg: 80,
      updated_at: '2026-09-17T11:00:00.000Z',
      user_id: 'user-alex',
    })

    const result = await createRepositories(client).participants.update(
      'participant-1',
      {
        challengeId: 'challenge-1',
        displayName: 'Alex Updated',
        joinedAt: '2026-09-17T10:00:00.000Z',
        startingWeightKg: 92.5,
        status: 'active',
        targetWeightKg: 80,
        userId: 'user-alex',
      },
    )

    expect(result).toMatchObject({
      data: {
        displayName: 'Alex Updated',
        id: 'participant-1',
      },
      state: 'success',
    })
  })

  it('upserts a weigh-in using participant and calendar date uniqueness', async () => {
    stubResponse({
      created_at: '2026-09-17T10:00:00.000Z',
      id: 'weigh-in-1',
      note: 'Corrected reading.',
      participant_id: 'participant-1',
      recorded_date: '2026-09-17',
      updated_at: '2026-09-17T11:00:00.000Z',
      weight_kg: 91.5,
    })

    const result = await createRepositories(client).weighIns.upsert({
      date: '2026-09-17',
      note: 'Corrected reading.',
      participantId: 'participant-1',
      weightKg: 91.5,
    })

    expect(result).toMatchObject({
      data: {
        date: '2026-09-17',
        participantId: 'participant-1',
        weightKg: 91.5,
      },
      state: 'success',
    })
  })

  it('returns a safe request error without exposing the server message', async () => {
    stubResponse(
      {
        code: '42501',
        details: 'permission denied for table challenges',
        hint: null,
        message: 'new row violates row-level security policy',
      },
      403,
    )

    const result =
      await createRepositories(client).challenges.findOwnedById('challenge-1')

    expect(result).toEqual({
      error: {
        code: '42501',
        kind: 'request',
        message: 'Unable to load the challenge.',
      },
      state: 'error',
    })
  })
})

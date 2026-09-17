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

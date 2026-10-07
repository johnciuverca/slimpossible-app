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
  it('maps only names, comparison dates, and counts for provisional leaders', async () => {
    stubResponse([
      {
        active_participant_count: 3,
        challenge_id: 'challenge-1',
        current_week_end: '2026-09-20',
        current_week_start: '2026-09-14',
        eligible_participant_count: 2,
        leader_count: 2,
        leader_latest_dates: ['2026-09-20', '2026-09-18'],
        leader_names: ['Ava', 'Ben'],
        previous_sunday: '2026-09-13',
        state: 'leaders',
        raw_history: [{ weight_kg: 95 }],
        note: 'private note',
      },
    ])

    const result = await createRepositories(
      client,
    ).groupProgress.getProvisionalLeader('challenge-1', '2026-09-15')

    expect(result).toEqual({
      data: {
        activeParticipantCount: 3,
        challengeId: 'challenge-1',
        currentWeekEnd: '2026-09-20',
        currentWeekStart: '2026-09-14',
        eligibleParticipantCount: 2,
        leaderCount: 2,
        leaderLatestDates: ['2026-09-20', '2026-09-18'],
        leaderNames: ['Ava', 'Ben'],
        previousSunday: '2026-09-13',
        state: 'leaders',
      },
      state: 'success',
    })
    expect(JSON.stringify(result)).not.toContain('private note')
    expect(JSON.stringify(result)).not.toContain('raw_history')
    const request = vi.mocked(fetch).mock.calls[0]
    expect(String(request?.[0])).toContain(
      '/rpc/get_provisional_group_leader_summary',
    )
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
      target_current_date: '2026-09-15',
    })
  })

  it('maps only aggregate group fields from the authorized RPC response', async () => {
    stubResponse([
      {
        active_participant_count: 3,
        average_completion_percentage: 47.5,
        challenge_id: 'challenge-1',
        current_sunday: '2026-09-20',
        eligible_participant_count: 2,
        participants_with_progress_count: 2,
        participants_with_recorded_weight_count: 3,
        previous_sunday: '2026-09-13',
        reached_target_count: 1,
        weekly_winner_count: 1,
        weekly_winner_names: ['Ava'],
        note: 'private note must not escape the mapper',
        raw_history: [{ weight_kg: 95 }],
      },
    ])

    const result = await createRepositories(
      client,
    ).groupProgress.getForChallenge('challenge-1', '2026-09-20')

    expect(result).toEqual({
      data: {
        activeParticipantCount: 3,
        averageCompletionPercentage: 47.5,
        challengeId: 'challenge-1',
        currentSunday: '2026-09-20',
        eligibleParticipantCount: 2,
        participantsWithProgressCount: 2,
        participantsWithRecordedWeightCount: 3,
        previousSunday: '2026-09-13',
        reachedTargetCount: 1,
        weeklyWinnerCount: 1,
        weeklyWinnerNames: ['Ava'],
      },
      state: 'success',
    })
    expect(JSON.stringify(result)).not.toContain('private note')
    expect(JSON.stringify(result)).not.toContain('raw_history')
    const request = vi.mocked(fetch).mock.calls[0]
    expect(String(request?.[0])).toContain('/rpc/get_group_progress_summary')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
      target_current_sunday: '2026-09-20',
    })
  })

  it('maps only the challenge-scoped shared weigh-in contract', async () => {
    stubResponse([
      {
        change_since_previous_kg: -1.5,
        display_name: 'Ava',
        recorded_date: '2026-09-20',
        weight_kg: 88.5,
        note: 'must not escape',
        participant_id: 'must not escape',
      },
    ])

    const result =
      await createRepositories(client).groupProgress.getWeighInHistory(
        'challenge-1',
      )

    expect(result).toEqual({
      data: [
        {
          changeSincePreviousKg: -1.5,
          date: '2026-09-20',
          displayName: 'Ava',
          weightKg: 88.5,
        },
      ],
      state: 'success',
    })
    expect(JSON.stringify(result)).not.toContain('must not escape')
    expect(JSON.stringify(result)).not.toContain('participant')
    expect(JSON.stringify(result)).not.toContain('note')
    const request = vi.mocked(fetch).mock.calls[0]
    expect(String(request?.[0])).toContain('/rpc/get_group_weigh_in_history')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
    })
  })

  it('uses the atomic personal save RPC and keeps its private result owner-scoped', async () => {
    stubResponse([
      {
        id: 'personal-entry-1',
        user_id: 'member-1',
        recorded_date: '2026-10-07',
        weight_kg: 82.4,
        note: 'private note',
        created_at: '2026-10-07T08:00:00.000Z',
        updated_at: '2026-10-07T08:00:00.000Z',
        shared_challenge_ids: ['group-1', 'group-2'],
      },
    ])

    const result = await createRepositories(client).personalWeighIns.save(
      'member-1',
      {
        id: 'personal-entry-1',
        date: '2026-10-07',
        note: ' private note ',
        sharedChallengeIds: ['group-1', 'group-2'],
        weightKg: 82.4,
      },
    )

    expect(result).toEqual({
      data: {
        id: 'personal-entry-1',
        date: '2026-10-07',
        note: 'private note',
        sharedChallengeIds: ['group-1', 'group-2'],
        weightKg: 82.4,
      },
      state: 'success',
    })
    const request = vi.mocked(fetch).mock.calls[0]
    expect(String(request?.[0])).toContain('/rpc/save_personal_weigh_in')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      target_note: 'private note',
      target_recorded_date: '2026-10-07',
      target_shared_challenge_ids: ['group-1', 'group-2'],
      target_weigh_in_id: 'personal-entry-1',
      target_weight_kg: 82.4,
    })
  })

  it('lists only the session owner’s personal entries and deletes through the server', async () => {
    stubResponse([
      {
        id: 'personal-entry-1',
        user_id: 'member-1',
        recorded_date: '2026-10-07',
        weight_kg: 82.4,
        note: 'private note',
        created_at: '2026-10-07T08:00:00.000Z',
        updated_at: '2026-10-07T08:00:00.000Z',
        shared_challenge_ids: [],
      },
    ])
    const listed =
      await createRepositories(client).personalWeighIns.listForUser('member-1')
    expect(listed.state).toBe('success')
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      '/rpc/list_my_personal_weigh_ins',
    )

    stubResponse(true)
    const deleted = await createRepositories(client).personalWeighIns.delete(
      'member-1',
      'personal-entry-1',
    )
    expect(deleted).toEqual({ data: true, state: 'success' })
    const request = vi.mocked(fetch).mock.calls.at(-1)
    expect(String(request?.[0])).toContain('/rpc/delete_personal_weigh_in')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      target_weigh_in_id: 'personal-entry-1',
    })
  })

  it('returns a safe denial for callers without active group membership', async () => {
    stubResponse(
      {
        code: '42501',
        details: 'private table detail',
        hint: null,
        message: 'Group membership required.',
      },
      403,
    )

    const result = await createRepositories(
      client,
    ).groupProgress.getForChallenge('challenge-1', '2026-09-20')

    expect(result).toEqual({
      error: {
        code: '42501',
        kind: 'request',
        message: 'Unable to load shared group progress.',
      },
      state: 'error',
    })
    expect(JSON.stringify(result)).not.toContain('private table detail')
  })

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
      challenge_kind: 'group',
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
    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>
    expect(requestBody).not.toHaveProperty('target_weight_kg')
    expect(requestBody).toHaveProperty('challenge_kind', 'group')
  })

  it('creates an explicit personal challenge without defaulting it to group', async () => {
    stubResponse({
      challenge_kind: 'personal',
      created_at: '2026-09-17T10:00:00.000Z',
      created_by: 'owner-1',
      description: null,
      end_date: '2026-10-01',
      id: 'personal-1',
      name: 'Private challenge',
      owner_id: 'owner-1',
      start_date: '2026-09-17',
      status: 'draft',
      target_weight_kg: null,
      updated_at: '2026-09-17T10:00:00.000Z',
    })

    const result = await createRepositories(client).challenges.create({
      createdBy: 'owner-1',
      endDate: '2026-10-01',
      kind: 'personal',
      name: 'Private challenge',
      ownerId: 'owner-1',
      startDate: '2026-09-17',
    })

    expect(result).toMatchObject({
      data: { id: 'personal-1', kind: 'personal' },
      state: 'success',
    })
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      challenge_kind: 'personal',
    })
  })

  it('preserves a legacy challenge target when updating without one', async () => {
    stubResponse({
      created_at: '2026-09-17T10:00:00.000Z',
      created_by: 'owner-1',
      description: null,
      end_date: '2026-12-01',
      id: 'legacy-challenge',
      name: 'Updated legacy challenge',
      owner_id: 'owner-1',
      start_date: '2026-09-01',
      status: 'draft',
      target_weight_kg: 85,
      updated_at: '2026-09-18T10:00:00.000Z',
    })

    const result = await createRepositories(client).challenges.update(
      'legacy-challenge',
      {
        createdBy: 'owner-1',
        endDate: '2026-12-01',
        name: 'Updated legacy challenge',
        ownerId: 'owner-1',
        startDate: '2026-09-01',
      },
    )

    expect(result).toMatchObject({
      data: { id: 'legacy-challenge', targetWeightKg: 85 },
      state: 'success',
    })
    const requestBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>
    expect(requestBody).not.toHaveProperty('target_weight_kg')
  })

  it('maps a database challenge row to the domain shape', async () => {
    stubResponse([
      {
        challenge_kind: null,
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

    const result =
      await createRepositories(client).challenges.listOwned('owner-1')

    expect(result).toEqual({
      data: [
        {
          kind: 'group',
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

  it('scopes challenge listing to the authenticated owner', async () => {
    stubResponse([])

    await createRepositories(client).challenges.listOwned('owner-1')

    const requestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(requestUrl).toContain('owner_id=eq.owner-1')
  })

  it('lists challenges without a caller-supplied owner filter for RLS to scope', async () => {
    stubResponse([])

    await createRepositories(client).challenges.listVisibleToUser('member-1')

    const requestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(requestUrl).toContain('/challenges?select=*')
    expect(requestUrl).not.toContain('owner_id=')
  })

  it('scopes participant listing to the authenticated user', async () => {
    stubResponse([])

    await createRepositories(client).participants.listForUser('member-1')

    const requestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0])
    expect(requestUrl).toContain('user_id=eq.member-1')
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
      share_with_group: true,
      updated_at: '2026-09-17T11:00:00.000Z',
      weight_kg: 91.5,
    })

    const result = await createRepositories(client).weighIns.upsert({
      date: '2026-09-17',
      note: 'Corrected reading.',
      participantId: 'participant-1',
      shareWithGroup: true,
      weightKg: 91.5,
    })

    expect(result).toMatchObject({
      data: {
        date: '2026-09-17',
        participantId: 'participant-1',
        shareWithGroup: true,
        weightKg: 91.5,
      },
      state: 'success',
    })
    const request = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      share_with_group: true,
    })
  })

  it('creates an invite through the owner RPC without persisting a raw identity', async () => {
    stubResponse([
      {
        challenge_id: 'challenge-1',
        expires_at: '2026-09-29T23:59:59.000Z',
        invite_id: 'invite-1',
        token: 'one-time-token',
      },
    ])

    const result = await createRepositories(client).invites.create(
      'challenge-1',
      '2026-09-29T23:59:59.000Z',
    )

    expect(result).toMatchObject({
      data: {
        invite: {
          challengeId: 'challenge-1',
          expiresAt: '2026-09-29T23:59:59.000Z',
          id: 'invite-1',
        },
        token: 'one-time-token',
      },
      state: 'success',
    })
    const requestBody = String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)
    expect(requestBody).toContain('target_challenge_id')
    expect(requestBody).not.toContain('user_id')
  })

  it('accepts an invite through the server-bound RPC', async () => {
    stubResponse({
      challenge_id: 'challenge-1',
      created_at: '2026-09-22T10:00:00.000Z',
      display_name: 'Accepted member',
      id: 'participant-1',
      joined_at: '2026-09-22T10:00:00.000Z',
      starting_weight_kg: 92.5,
      status: 'active',
      target_weight_kg: 80,
      updated_at: '2026-09-22T10:00:00.000Z',
      user_id: 'auth-bound-user',
    })

    const result = await createRepositories(client).invites.accept(
      'one-time-token',
      {
        displayName: 'Accepted member',
        startingWeightKg: 92.5,
        targetWeightKg: 80,
      },
      'user-entered-value-that-must-be-ignored',
    )

    expect(result).toMatchObject({
      data: { id: 'participant-1', userId: 'auth-bound-user' },
      state: 'success',
    })
    const requestBody = String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)
    expect(requestBody).not.toContain('user-entered-value-that-must-be-ignored')
  })

  it('maps expired and revoked preview states for the UI', async () => {
    stubResponse([
      {
        challenge_id: 'challenge-1',
        challenge_name: 'Autumn challenge',
        expires_at: '2026-09-20T23:59:59.000Z',
        invite_id: 'invite-1',
        revoked_at: null,
        status: 'expired',
      },
    ])

    const expired = await createRepositories(client).invites.preview('expired')
    expect(expired).toMatchObject({
      data: { status: 'expired' },
      state: 'success',
    })

    stubResponse([
      {
        challenge_id: 'challenge-1',
        challenge_name: 'Autumn challenge',
        expires_at: '2026-09-29T23:59:59.000Z',
        invite_id: 'invite-1',
        revoked_at: '2026-09-22T12:00:00.000Z',
        status: 'revoked',
      },
    ])
    const revoked = await createRepositories(client).invites.preview('revoked')
    expect(revoked).toMatchObject({
      data: { status: 'revoked' },
      state: 'success',
    })
  })

  it('turns server revocation errors into safe invitation feedback', async () => {
    stubResponse(
      {
        code: 'P0003',
        details: 'internal invitation details',
        hint: null,
        message: 'Invitation is expired.',
      },
      400,
    )

    const result = await createRepositories(client).invites.accept(
      'expired-token',
      { displayName: 'Member', startingWeightKg: 90, targetWeightKg: 80 },
    )

    expect(result).toEqual({
      error: {
        code: 'P0003',
        kind: 'request',
        message: 'This invitation has expired.',
      },
      state: 'error',
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

    const result = await createRepositories(client).challenges.findOwnedById(
      'challenge-1',
      'owner-1',
    )

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

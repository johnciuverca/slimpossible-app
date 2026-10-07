import { afterEach, describe, expect, it } from 'vitest'

import { createPersistence } from './persistence'

const signedOutState = {
  error: null,
  status: 'signed-out' as const,
  user: null,
}

afterEach(() => {
  window.localStorage.clear()
})

describe('challenge and participant persistence', () => {
  it('reads legacy local challenges as groups without rewriting saved JSON', async () => {
    const legacyJson = JSON.stringify([
      {
        createdAt: '2026-09-17T10:00:00.000Z',
        createdBy: 'legacy-owner',
        endDate: '2026-12-01',
        id: 'legacy-challenge',
        name: 'Legacy group',
        ownerId: 'legacy-owner',
        startDate: '2026-09-01',
        status: 'draft',
        updatedAt: '2026-09-17T10:00:00.000Z',
      },
    ])
    window.localStorage.setItem('slimpossible.local.challenges', legacyJson)
    const persistence = createPersistence(signedOutState)
    if (persistence.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    await expect(
      persistence.repositories.challenges.listOwned('legacy-owner'),
    ).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: 'legacy-challenge', kind: 'group' }),
      ],
      state: 'success',
    })
    expect(window.localStorage.getItem('slimpossible.local.challenges')).toBe(
      legacyJson,
    )
  })

  it('shows owners and active members only in the local challenge preview', async () => {
    const persistence = createPersistence(signedOutState)
    if (persistence.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    const createChallenge = async (ownerId: string, name: string) => {
      const result = await persistence.repositories.challenges.create({
        createdBy: ownerId,
        endDate: '2026-11-01',
        name,
        ownerId,
        startDate: '2026-10-01',
      })
      if (result.state !== 'success')
        throw new Error('Challenge creation failed')
      return result.data
    }

    const owned = await createChallenge('member-1', 'Owned')
    const joined = await createChallenge('owner-1', 'Joined')
    const unrelated = await createChallenge('other-user', 'Unrelated')
    const inactive = await createChallenge('owner-2', 'Inactive membership')

    await persistence.repositories.participants.create({
      challengeId: joined.id,
      displayName: 'Member',
      startingWeightKg: 90,
      targetWeightKg: 80,
      userId: 'member-1',
      status: 'active',
    })
    await persistence.repositories.participants.create({
      challengeId: inactive.id,
      displayName: 'Member',
      startingWeightKg: 90,
      targetWeightKg: 80,
      userId: 'member-1',
      status: 'invited',
    })
    await persistence.repositories.participants.create({
      challengeId: unrelated.id,
      displayName: 'Other user',
      startingWeightKg: 90,
      targetWeightKg: 80,
      userId: 'other-user',
      status: 'active',
    })

    await expect(
      persistence.repositories.challenges.listVisibleToUser('member-1'),
    ).resolves.toEqual({ data: [joined, owned], state: 'success' })
  })

  it('keeps the local MVP data after a new persistence instance is created', async () => {
    const first = createPersistence(signedOutState)
    if (first.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    const challenge = await first.repositories.challenges.create({
      createdBy: 'local-owner',
      endDate: '2026-11-01',
      name: 'Autumn reset',
      ownerId: 'local-owner',
      startDate: '2026-10-01',
    })
    expect(challenge.state).toBe('success')
    if (challenge.state !== 'success') {
      return
    }

    const firstParticipant = await first.repositories.participants.create({
      challengeId: challenge.data.id,
      displayName: 'Alex Participant',
      joinedAt: '2026-10-01T08:00:00.000Z',
      startingWeightKg: 92.5,
      status: 'active',
      targetWeightKg: 80,
      userId: 'alex-1',
    })
    expect(firstParticipant.state).toBe('success')
    if (firstParticipant.state !== 'success') {
      return
    }

    const secondParticipant = await first.repositories.participants.create({
      challengeId: challenge.data.id,
      displayName: 'Sam Participant',
      joinedAt: '2026-10-01T08:00:00.000Z',
      startingWeightKg: 86.2,
      status: 'active',
      targetWeightKg: 76,
      userId: 'sam-1',
    })
    expect(secondParticipant.state).toBe('success')
    if (secondParticipant.state !== 'success') {
      return
    }

    await first.repositories.weighIns.upsert({
      date: '2026-10-01',
      note: 'Morning reading.',
      participantId: firstParticipant.data.id,
      weightKg: 91.8,
    })
    await first.repositories.weighIns.upsert({
      date: '2026-10-01',
      note: 'Corrected reading.',
      participantId: firstParticipant.data.id,
      weightKg: 91.5,
    })
    await first.repositories.weighIns.upsert({
      date: '2026-10-01',
      note: 'Second participant private note.',
      participantId: secondParticipant.data.id,
      weightKg: 85.7,
    })

    const second = createPersistence(signedOutState)
    if (second.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    await expect(
      second.repositories.challenges.listOwned('local-owner'),
    ).resolves.toEqual({
      data: [challenge.data],
      state: 'success',
    })
    await expect(
      second.repositories.participants.listForChallenge(challenge.data.id),
    ).resolves.toEqual({
      data: [secondParticipant.data, firstParticipant.data],
      state: 'success',
    })
    await expect(
      second.repositories.weighIns.listForParticipant(firstParticipant.data.id),
    ).resolves.toEqual({
      data: [
        {
          date: '2026-10-01',
          note: 'Corrected reading.',
          participantId: firstParticipant.data.id,
          shareWithGroup: false,
          weightKg: 91.5,
        },
      ],
      state: 'success',
    })
    await expect(
      second.repositories.weighIns.listForParticipant(
        secondParticipant.data.id,
      ),
    ).resolves.toEqual({
      data: [
        {
          date: '2026-10-01',
          note: 'Second participant private note.',
          participantId: secondParticipant.data.id,
          shareWithGroup: false,
          weightKg: 85.7,
        },
      ],
      state: 'success',
    })
  })

  it('keeps personal weigh-ins independent of challenges and unique by user/date', async () => {
    const persistence = createPersistence(signedOutState)
    if (persistence.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    const first = await persistence.repositories.personalWeighIns.save(
      'member-1',
      {
        date: '2026-10-06',
        note: 'Private note',
        sharedChallengeIds: [],
        weightKg: 82.4,
      },
    )
    expect(first.state).toBe('success')

    const correction = await persistence.repositories.personalWeighIns.save(
      'member-1',
      {
        date: '2026-10-06',
        note: 'Corrected private note',
        sharedChallengeIds: [],
        weightKg: 82.1,
      },
    )
    expect(correction).toMatchObject({
      data: {
        date: '2026-10-06',
        note: 'Corrected private note',
        sharedChallengeIds: [],
        weightKg: 82.1,
      },
      state: 'success',
    })
    if (first.state === 'success' && correction.state === 'success') {
      expect(correction.data.id).toBe(first.data.id)
    }
    await expect(
      persistence.repositories.personalWeighIns.listForUser('member-1'),
    ).resolves.toMatchObject({ data: [{ weightKg: 82.1 }], state: 'success' })
    await expect(
      persistence.repositories.personalWeighIns.listForUser('member-2'),
    ).resolves.toEqual({ data: [], state: 'empty' })
    await expect(
      persistence.repositories.personalWeighIns.delete(
        'member-2',
        correction.state === 'success' ? correction.data.id : '',
      ),
    ).resolves.toEqual({ data: null, state: 'empty' })
  })

  it('does not enable remote writes without a signed-in Supabase user id', () => {
    expect(
      createPersistence(signedOutState, window.localStorage, {
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toEqual({
      message:
        'Remote persistence is unavailable until a Supabase session is signed in.',
      mode: 'unavailable',
    })
  })
})

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

    await first.repositories.participants.create({
      challengeId: challenge.data.id,
      displayName: 'Alex Participant',
      joinedAt: '2026-10-01T08:00:00.000Z',
      startingWeightKg: 92.5,
      status: 'active',
      targetWeightKg: 80,
      userId: 'alex-1',
    })
    await first.repositories.weighIns.upsert({
      date: '2026-10-01',
      note: 'Morning reading.',
      participantId: 'participant-1',
      weightKg: 91.8,
    })
    await first.repositories.weighIns.upsert({
      date: '2026-10-01',
      note: 'Corrected reading.',
      participantId: 'participant-1',
      weightKg: 91.5,
    })

    const second = createPersistence(signedOutState)
    if (second.mode !== 'local') {
      throw new Error('Expected local persistence without public configuration')
    }

    await expect(second.repositories.challenges.listOwned()).resolves.toEqual({
      data: [challenge.data],
      state: 'success',
    })
    await expect(
      second.repositories.participants.listForChallenge(challenge.data.id),
    ).resolves.toMatchObject({ state: 'success' })
    await expect(
      second.repositories.weighIns.listForParticipant('participant-1'),
    ).resolves.toEqual({
      data: [
        {
          date: '2026-10-01',
          note: 'Corrected reading.',
          participantId: 'participant-1',
          weightKg: 91.5,
        },
      ],
      state: 'success',
    })
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

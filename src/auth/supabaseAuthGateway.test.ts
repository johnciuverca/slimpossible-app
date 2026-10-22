import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../data/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    client: {
      auth: {
        resetPasswordForEmail: mocks.resetPasswordForEmail,
        signUp: mocks.signUp,
      },
    },
    state: 'configured',
  }),
}))

vi.mock('../data/supabase/repositories', () => ({
  createRepositories: vi.fn(() => ({
    profiles: { ensure: mocks.ensureProfile },
  })),
}))

import { createSupabaseAuthGateway } from './supabaseAuth'

describe('Supabase auth redirect configuration', () => {
  beforeEach(() => {
    mocks.resetPasswordForEmail.mockReset()
    mocks.signUp.mockReset()
    mocks.ensureProfile.mockReset()
  })

  it('uses fixed same-origin verification and recovery destinations', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { email: 'person@example.com', id: 'user-1' },
      },
      error: null,
    })
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    const gateway = createSupabaseAuthGateway()

    await gateway.signUp('Participant', 'person@example.com', 'password')
    await gateway.requestPasswordRecovery(
      'person@example.com',
      `${window.location.origin}/reset-password`,
    )

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'person@example.com',
      options: {
        data: { display_name: 'Participant' },
        emailRedirectTo: `${window.location.origin}/login`,
      },
      password: 'password',
    })
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'person@example.com',
      { redirectTo: `${window.location.origin}/reset-password` },
    )
  })

  it('keeps the confirmed signup name as a seed for later profile initialization', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: null,
        user: {
          email: 'person@example.com',
          id: 'user-1',
          user_metadata: { display_name: '  Participant  ' },
        },
      },
      error: null,
    })
    mocks.ensureProfile.mockResolvedValue({
      data: { displayName: 'Participant', id: 'user-1' },
      state: 'success',
    })

    const gateway = createSupabaseAuthGateway()
    const signup = await gateway.signUp(
      'Participant',
      'person@example.com',
      'password',
    )

    expect(signup).toEqual({
      needsVerification: true,
      user: {
        displayName: 'Participant',
        email: 'person@example.com',
        id: 'user-1',
      },
    })
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
    await expect(gateway.ensureProfile(signup.user!)).resolves.toBe(
      'Participant',
    )
    expect(mocks.ensureProfile).toHaveBeenCalledWith({
      displayName: 'Participant',
      id: 'user-1',
    })
  })

  it('does not fall back to email or create a profile when no usable name exists', async () => {
    mocks.ensureProfile.mockResolvedValue({ data: null, state: 'empty' })
    const gateway = createSupabaseAuthGateway()

    await expect(
      gateway.ensureProfile({ email: 'person@example.com', id: 'user-1' }),
    ).resolves.toBeUndefined()
    expect(mocks.ensureProfile).toHaveBeenCalledWith({
      displayName: undefined,
      id: 'user-1',
    })
  })

  it('uses a saved profile name instead of signup metadata', async () => {
    mocks.ensureProfile.mockResolvedValue({
      data: { displayName: 'Updated saved name', id: 'user-1' },
      state: 'success',
    })
    const gateway = createSupabaseAuthGateway()

    await expect(
      gateway.ensureProfile({
        displayName: 'Old signup name',
        email: 'person@example.com',
        id: 'user-1',
      }),
    ).resolves.toBe('Updated saved name')
  })
})

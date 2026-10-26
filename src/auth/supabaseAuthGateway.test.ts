import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  reauthenticate: vi.fn(),
  saveName: vi.fn(),
  ensureProfile: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../data/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    client: {
      auth: {
        getUser: mocks.getUser,
        reauthenticate: mocks.reauthenticate,
        resetPasswordForEmail: mocks.resetPasswordForEmail,
        signUp: mocks.signUp,
        updateUser: mocks.updateUser,
      },
    },
    state: 'configured',
  }),
}))

vi.mock('../data/supabase/repositories', () => ({
  createRepositories: vi.fn(() => ({
    profiles: { ensure: mocks.ensureProfile, saveName: mocks.saveName },
  })),
}))

import { createSupabaseAuthGateway } from './supabaseAuth'

describe('Supabase auth redirect configuration', () => {
  beforeEach(() => {
    mocks.resetPasswordForEmail.mockReset()
    mocks.signUp.mockReset()
    mocks.ensureProfile.mockReset()
    mocks.getUser.mockReset()
    mocks.reauthenticate.mockReset()
    mocks.updateUser.mockReset()
    mocks.saveName.mockReset()
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

  it('requests an email change only for the currently authenticated account', async () => {
    mocks.getUser
      .mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: 'other-user' } },
        error: null,
      })
    mocks.updateUser.mockResolvedValue({ error: null })
    const gateway = createSupabaseAuthGateway()

    await gateway.requestEmailChange(
      { email: 'old@example.com', id: 'user-1' },
      'new@example.com',
    )
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' })

    await expect(
      gateway.requestEmailChange(
        { email: 'old@example.com', id: 'user-1' },
        'other@example.com',
      ),
    ).rejects.toThrow('Your account changed.')
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })

  it('changes the password only for the current account and supplies the current password', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.updateUser.mockResolvedValue({ error: null })
    const gateway = createSupabaseAuthGateway()

    await expect(
      gateway.changePassword!(
        { email: 'person@example.com', id: 'user-1' },
        'current-secret',
        'new-secret-password',
      ),
    ).resolves.toBe('updated')
    expect(mocks.updateUser).toHaveBeenCalledWith({
      current_password: 'current-secret',
      nonce: undefined,
      password: 'new-secret-password',
    })

    mocks.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-2' } },
      error: null,
    })
    await expect(
      gateway.changePassword!(
        { email: 'person@example.com', id: 'user-1' },
        'current-secret',
        'other-new-password',
      ),
    ).rejects.toThrow('Your account changed.')
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })

  it('requests Supabase reauthentication when configured and submits its nonce', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.updateUser
      .mockResolvedValueOnce({
        error: {
          code: 'reauthentication_needed',
          message: 'Reauthentication required',
        },
      })
      .mockResolvedValueOnce({ error: null })
    mocks.reauthenticate.mockResolvedValue({ error: null })
    const gateway = createSupabaseAuthGateway()
    const user = { email: 'person@example.com', id: 'user-1' }

    await expect(
      gateway.changePassword!(user, 'current-secret', 'new-secret-password'),
    ).resolves.toBe('reauthentication-required')
    expect(mocks.reauthenticate).toHaveBeenCalledOnce()

    await expect(
      gateway.changePassword!(
        user,
        'current-secret',
        'new-secret-password',
        '654321',
      ),
    ).resolves.toBe('updated')
    expect(mocks.updateUser).toHaveBeenLastCalledWith({
      current_password: 'current-secret',
      nonce: '654321',
      password: 'new-secret-password',
    })
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

  it('saves only the authenticated UUID and trimmed canonical profile name', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.saveName.mockResolvedValue({
      state: 'success',
      data: { id: 'user-1', displayName: 'New nickname' },
    })
    await expect(
      createSupabaseAuthGateway().saveProfileName(
        { id: 'user-1', email: 'person@example.com' },
        '  New nickname  ',
      ),
    ).resolves.toBe('New nickname')
    expect(mocks.saveName).toHaveBeenCalledWith({
      id: 'user-1',
      displayName: 'New nickname',
    })
  })

  it('does not write when the authenticated account has switched', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-2' } },
      error: null,
    })
    await expect(
      createSupabaseAuthGateway().saveProfileName(
        { id: 'user-1', email: 'person@example.com' },
        'Nickname',
      ),
    ).rejects.toThrow('Your account changed')
    expect(mocks.saveName).not.toHaveBeenCalled()
  })
})

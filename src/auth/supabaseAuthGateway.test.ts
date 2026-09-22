import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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
  createRepositories: vi.fn(),
}))

import { createSupabaseAuthGateway } from './supabaseAuth'

describe('Supabase auth redirect configuration', () => {
  beforeEach(() => {
    mocks.resetPasswordForEmail.mockReset()
    mocks.signUp.mockReset()
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
})

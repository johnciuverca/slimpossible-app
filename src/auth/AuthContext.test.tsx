import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const signedOutGateway = {
  ensureProfile: async () => undefined,
  getSession: async () => null,
  onAuthStateChange: () => () => undefined,
  signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
  signOut: async () => undefined,
  signUp: async () => ({ needsVerification: false, user: null }),
}

import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

function AuthHarness() {
  const { signIn, signUp, state } = useAuth()

  return (
    <>
      <output>{state.status}</output>
      {state.status === 'signed-in' ? <p>{state.user.email}</p> : null}
      <button onClick={() => void signIn('person@example.com', 'password')}>
        Sign in locally
      </button>
      <button
        onClick={() =>
          void signUp('Participant', 'person@example.com', 'password')
        }
      >
        Sign up
      </button>
    </>
  )
}

describe('AuthContext', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('restores a signed-out session without exposing protected content', async () => {
    vi.useFakeTimers()
    render(
      <AuthProvider authGateway={signedOutGateway}>
        <AuthHarness />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(150)
      await Promise.resolve()
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('can create a local signed-in session without storing a password', async () => {
    vi.useFakeTimers()

    render(
      <AuthProvider
        authGateway={{
          ensureProfile: async () => undefined,
          getSession: async () => null,
          onAuthStateChange: () => () => undefined,
          signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
          signUp: async () => ({
            needsVerification: false,
            user: { email: 'person@example.com', id: 'user-1' },
          }),
          signOut: async () => undefined,
        }}
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in locally' }))
      await Promise.resolve()
    })

    expect(screen.getByText('signed-in')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()
    expect(screen.queryByText('password')).not.toBeInTheDocument()
  })

  it('does not initialize a profile before email verification', async () => {
    const ensureProfile = vi.fn(async () => undefined)

    render(
      <AuthProvider
        authGateway={{
          ensureProfile,
          getSession: async () => null,
          onAuthStateChange: () => () => undefined,
          signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
          signOut: async () => undefined,
          signUp: async () => ({
            needsVerification: true,
            user: { email: 'person@example.com', id: 'user-1' },
          }),
        }}
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      await Promise.resolve()
    })

    expect(screen.getByText('verification-pending')).toBeInTheDocument()
    expect(ensureProfile).not.toHaveBeenCalled()
  })
})

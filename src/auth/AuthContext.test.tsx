import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('starts loading and settles into a signed-out local session', () => {
    vi.useFakeTimers()

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('can create a local signed-in session without storing a password', async () => {
    vi.useFakeTimers()

    render(
      <AuthProvider
        authGateway={{
          signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
          signUp: async () => ({
            needsVerification: false,
            user: { email: 'person@example.com', id: 'user-1' },
          }),
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
})

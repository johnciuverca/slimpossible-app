import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

function AuthHarness() {
  const { signIn, state } = useAuth()

  return (
    <>
      <output>{state.status}</output>
      {state.status === 'signed-in' ? <p>{state.user.email}</p> : null}
      <button onClick={() => void signIn('person@example.com', 'password')}>
        Sign in locally
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
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sign in locally' }))

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByText('signed-in')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()
    expect(screen.queryByText('password')).not.toBeInTheDocument()
  })
})

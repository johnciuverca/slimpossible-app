import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuthGateway } from './context'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

const signedOutGateway: AuthGateway = {
  requestEmailChange: async () => undefined,
  saveProfileName: async (_user, name) => name,
  ensureProfile: async () => undefined,
  getSession: async () => null,
  onAuthStateChange: () => () => undefined,
  requestPasswordRecovery: async () => undefined,
  resetPassword: async () => undefined,
  signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
  signOut: async () => undefined,
  signUp: async () => ({ needsVerification: false, user: null }),
}

function AuthHarness() {
  const { signIn, signOut, signUp, state } = useAuth()

  return (
    <>
      <output>{state.status}</output>
      {state.status === 'signed-in' ? (
        <>
          <p>{state.user.email}</p>
          <p>{state.user.displayName}</p>
          {state.profileError ? (
            <p role="status">{state.profileError}</p>
          ) : null}
        </>
      ) : null}
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
      <button onClick={() => void signOut()}>Sign out</button>
    </>
  )
}

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return { ...signedOutGateway, ...overrides }
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
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('can create a local signed-in session without storing a password', async () => {
    vi.useFakeTimers()

    render(
      <AuthProvider
        authGateway={signedOutGateway}
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
        authGateway={createGateway({
          ensureProfile,
          signUp: async () => ({
            needsVerification: true,
            user: { email: 'person@example.com', id: 'user-1' },
          }),
        })}
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

  it('treats a password recovery event as a recovery-only session', async () => {
    vi.useFakeTimers()
    const ensureProfile = vi.fn(async () => undefined)
    const user = { email: 'person@example.com', id: 'user-1' }
    let emitAuthEvent:
      ((nextUser: typeof user | null, event?: string) => void) | undefined

    render(
      <AuthProvider
        authGateway={createGateway({
          ensureProfile,
          onAuthStateChange: (callback) => {
            emitAuthEvent = callback
            return () => undefined
          },
        })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      emitAuthEvent?.(user, 'PASSWORD_RECOVERY')
    })

    expect(screen.getByText('recovery-ready')).toBeInTheDocument()
    expect(ensureProfile).not.toHaveBeenCalled()
  })

  it('settles a refreshed session and initializes its profile once', async () => {
    vi.useFakeTimers()
    const user = { email: 'person@example.com', id: 'user-1' }
    const ensureProfile = vi.fn(async () => undefined)

    render(
      <AuthProvider
        authGateway={createGateway({
          ensureProfile,
          getSession: async () => user,
        })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })

    expect(screen.getByText('signed-in')).toBeInTheDocument()
    expect(ensureProfile).toHaveBeenCalledTimes(1)
  })

  it('uses the persisted profile name after session restoration', async () => {
    vi.useFakeTimers()
    const user = {
      displayName: 'Signup metadata',
      email: 'person@example.com',
      id: 'user-1',
    }

    render(
      <AuthProvider
        authGateway={createGateway({
          ensureProfile: async () => 'Saved profile name',
          getSession: async () => user,
        })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Saved profile name')).toBeInTheDocument()
    expect(screen.getByText('signed-in')).toBeInTheDocument()
  })

  it('keeps the authenticated session when profile initialization fails', async () => {
    vi.useFakeTimers()

    render(
      <AuthProvider
        authGateway={createGateway({
          ensureProfile: async () => {
            throw new Error('private database detail')
          },
          getSession: async () => ({
            email: 'person@example.com',
            id: 'user-1',
          }),
        })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      vi.runOnlyPendingTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('signed-in')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your profile name could not be saved. You are still signed in.',
      ),
    ).toHaveAttribute('role', 'status')
    expect(
      screen.queryByText('private database detail'),
    ).not.toBeInTheDocument()
  })

  it('defers repeated auth-event profile work and shares one in-flight request', async () => {
    vi.useFakeTimers()
    const user = { email: 'person@example.com', id: 'user-1' }
    let emitAuthEvent: ((nextUser: typeof user | null) => void) | undefined
    let resolveProfile!: (displayName?: string) => void
    const profileRequest = new Promise<string | undefined>((resolve) => {
      resolveProfile = resolve
    })
    const ensureProfile = vi.fn(() => profileRequest)

    render(
      <AuthProvider
        authGateway={createGateway({
          ensureProfile,
          onAuthStateChange: (callback) => {
            emitAuthEvent = callback
            return () => undefined
          },
        })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })

    await act(async () => {
      emitAuthEvent?.(user)
    })
    expect(ensureProfile).not.toHaveBeenCalled()

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expect(ensureProfile).toHaveBeenCalledTimes(1)

    await act(async () => {
      emitAuthEvent?.(user)
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expect(ensureProfile).toHaveBeenCalledTimes(1)

    resolveProfile()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      emitAuthEvent?.(user)
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expect(ensureProfile).toHaveBeenCalledTimes(1)
  })

  it('does not rerender for duplicate authenticated session events', async () => {
    vi.useFakeTimers()
    const user = { email: 'person@example.com', id: 'user-1' }
    let emitAuthEvent: ((nextUser: typeof user | null) => void) | undefined
    let renderCount = 0

    function RenderCountHarness() {
      renderCount += 1
      const { state } = useAuth()
      return <output>{state.status}</output>
    }

    render(
      <AuthProvider
        authGateway={createGateway({
          getSession: async () => user,
          onAuthStateChange: (callback) => {
            emitAuthEvent = callback
            return () => undefined
          },
        })}
      >
        <RenderCountHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expect(screen.getByText('signed-in')).toBeInTheDocument()
    const renderCountAfterRestore = renderCount

    await act(async () => {
      emitAuthEvent?.(user)
      emitAuthEvent?.(user)
      await Promise.resolve()
    })

    expect(renderCount).toBe(renderCountAfterRestore)
  })

  it('ignores a stale session restore after logout', async () => {
    vi.useFakeTimers()
    let resolveSession!: (user: { email: string; id: string } | null) => void
    const sessionRequest = new Promise<{ email: string; id: string } | null>(
      (resolve) => {
        resolveSession = resolve
      },
    )

    render(
      <AuthProvider
        authGateway={createGateway({ getSession: () => sessionRequest })}
      >
        <AuthHarness />
      </AuthProvider>,
    )

    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByText('signed-out')).toBeInTheDocument()

    resolveSession({ email: 'person@example.com', id: 'user-1' })
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
    expect(screen.queryByText('person@example.com')).not.toBeInTheDocument()
  })

  it('ignores a password change that finishes after the signed-in account changes', async () => {
    let resolveChange!: (result: 'updated') => void
    const changeRequest = new Promise<'updated'>((resolve) => {
      resolveChange = resolve
    })
    function PasswordChangeHarness() {
      const { changePassword, signOut, state } = useAuth()
      const [result, setResult] = useState<string>('pending')
      return (
        <>
          <output>{state.status}</output>
          <output aria-label="Password change result">{result}</output>
          <button
            onClick={() => {
              if (!changePassword) return
              void changePassword('current-secret', 'new-secret-password').then(
                (value) => setResult(String(value)),
              )
            }}
          >
            Change password
          </button>
          <button onClick={() => void signOut()}>Switch account</button>
        </>
      )
    }

    render(
      <AuthProvider
        authGateway={createGateway({
          changePassword: async () => changeRequest,
        })}
        initialState={{
          error: null,
          status: 'signed-in',
          user: { email: 'person@example.com', id: 'user-1' },
        }}
      >
        <PasswordChangeHarness />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fireEvent.click(screen.getByRole('button', { name: 'Switch account' }))
    expect(screen.getByText('signed-out')).toBeInTheDocument()
    resolveChange('updated')

    await act(async () => {
      await changeRequest
    })
    expect(screen.getByLabelText('Password change result')).toHaveTextContent(
      'false',
    )
    expect(screen.queryByText('updated')).not.toBeInTheDocument()
  })
})

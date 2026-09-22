import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthGateway } from '../auth/context'
import { ResetPasswordPage } from './ResetPasswordPage'

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    ensureProfile: async () => undefined,
    getSession: async () => null,
    onAuthStateChange: () => () => undefined,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => undefined,
    signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
    signOut: async () => undefined,
    signUp: async () => ({ needsVerification: false, user: null }),
    ...overrides,
  }
}

function LocationOutput() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}

describe('ResetPasswordPage', () => {
  afterEach(() => cleanup())

  it('does not show the password form for an invalid or expired link', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'recovery-invalid', user: null }}
      >
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      screen.getByText(
        'This password recovery link is invalid or expired. Request a new link.',
      ),
    ).toHaveAttribute('role', 'alert')
    expect(
      screen.queryByRole('form', { name: 'Reset password form' }),
    ).not.toBeInTheDocument()
  })

  it('updates a password only for a valid recovery session and returns to login', async () => {
    const resetPassword = vi.fn(async () => undefined)
    const signOut = vi.fn(async () => undefined)

    render(
      <AuthProvider
        authGateway={createGateway({ resetPassword, signOut })}
        initialState={{
          error: null,
          status: 'recovery-ready',
          user: { email: 'person@example.com', id: 'user-1' },
        }}
      >
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
          <LocationOutput />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-password' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Reset password form' }))

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith('new-password'),
    )
    expect(signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('/login')).toBeInTheDocument())
  })
})

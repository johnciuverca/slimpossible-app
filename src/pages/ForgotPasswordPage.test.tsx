import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthGateway } from '../auth/context'
import { ForgotPasswordPage } from './ForgotPasswordPage'

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

describe('ForgotPasswordPage', () => {
  afterEach(() => cleanup())

  it('validates email and gives the same confirmation for a recovery request', async () => {
    const requestPasswordRecovery = vi.fn(async () => undefined)

    render(
      <AuthProvider
        authGateway={createGateway({ requestPasswordRecovery })}
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.submit(
      screen.getByRole('form', { name: 'Password recovery form' }),
    )
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    fireEvent.submit(
      screen.getByRole('form', { name: 'Password recovery form' }),
    )

    await waitFor(() =>
      expect(requestPasswordRecovery).toHaveBeenCalledWith(
        'person@example.com',
        `${window.location.origin}/reset-password`,
      ),
    )
    expect(
      screen.getByText(
        'If an account matches that email, we sent a password recovery link. Check your inbox and spam folder.',
      ),
    ).toBeInTheDocument()
  })

  it('shows a safe retry message when the request cannot be sent', async () => {
    render(
      <AuthProvider
        authGateway={createGateway({
          requestPasswordRecovery: async () => {
            throw new Error('We could not request a recovery link. Try again.')
          },
        })}
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send recovery link' }))

    expect(
      await screen.findByText(
        'We could not request a recovery link. Try again.',
      ),
    ).toBeInTheDocument()
  })
})

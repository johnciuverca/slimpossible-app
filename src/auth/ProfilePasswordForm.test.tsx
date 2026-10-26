import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import type { AuthGateway } from './context'
import { ProfilePasswordForm } from './ProfilePasswordForm'

function makeGateway(
  changePassword: NonNullable<AuthGateway['changePassword']> = async () =>
    'updated',
): AuthGateway {
  return {
    changePassword,
    requestEmailChange: async () => undefined,
    ensureProfile: async () => undefined,
    getSession: async () => ({ email: 'person@example.com', id: 'user-1' }),
    onAuthStateChange: () => () => undefined,
    saveProfileName: async (_user, name) => name,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => undefined,
    signIn: async () => ({ email: 'person@example.com', id: 'user-1' }),
    signOut: async () => undefined,
    signUp: async () => ({ needsVerification: false, user: null }),
  }
}

function renderForm(gateway: AuthGateway) {
  return render(
    <AuthProvider
      authGateway={gateway}
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: 'person@example.com', id: 'user-1' },
      }}
    >
      <ProfilePasswordForm
        onDirtyChange={() => undefined}
        onSavingChange={() => undefined}
      />
    </AuthProvider>,
  )
}

function fillPasswords() {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'old-secret-value' },
  })
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'new-secret-value' },
  })
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'new-secret-value' },
  })
}

describe('ProfilePasswordForm', () => {
  afterEach(cleanup)

  it('validates matching passwords and accessible show/hide controls before calling Auth', async () => {
    const changePassword = vi.fn(async () => 'updated' as const)
    renderForm(makeGateway(changePassword))
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fillPasswords()
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different-secret' },
    })
    const revealButton = screen.getByRole('button', {
      name: 'Show new password',
    })
    expect(revealButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(revealButton)
    expect(screen.getByLabelText('New password')).toHaveAttribute(
      'type',
      'text',
    )
    expect(
      screen.getByRole('button', { name: 'Hide new password' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your passwords do not match.',
    )
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('updates the signed-in account password and clears secret inputs', async () => {
    const changePassword = vi.fn(async () => 'updated' as const)
    renderForm(makeGateway(changePassword))
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fillPasswords()
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
    expect(changePassword).toHaveBeenCalledWith(
      { email: 'person@example.com', id: 'user-1' },
      'old-secret-value',
      'new-secret-value',
      undefined,
    )
    expect(
      screen.queryByDisplayValue('new-secret-value'),
    ).not.toBeInTheDocument()
  })

  it('requests a reauthentication code and resubmits it without exposing secrets', async () => {
    const changePassword = vi
      .fn<NonNullable<AuthGateway['changePassword']>>()
      .mockResolvedValueOnce('reauthentication-required')
      .mockResolvedValueOnce('updated')
    renderForm(makeGateway(changePassword))
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fillPasswords()
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    expect(
      await screen.findByLabelText('Verification code'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(2))
    expect(changePassword).toHaveBeenLastCalledWith(
      { email: 'person@example.com', id: 'user-1' },
      'old-secret-value',
      'new-secret-value',
      '123456',
    )
    expect(await screen.findByText('Password updated.')).toBeInTheDocument()
  })
})

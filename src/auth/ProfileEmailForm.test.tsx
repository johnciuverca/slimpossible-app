import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { AuthSessionUI } from './AuthSessionUI'
import type { AuthGateway } from './context'

const user = { displayName: 'Alex', email: 'alex@example.com', id: 'alex' }

function renderProfile(requestEmailChange: AuthGateway['requestEmailChange']) {
  const gateway: AuthGateway = {
    requestEmailChange,
    ensureProfile: async (currentUser) => currentUser.displayName,
    getSession: async () => user,
    onAuthStateChange: () => () => undefined,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => undefined,
    signIn: async () => user,
    signOut: async () => undefined,
    signUp: async () => ({ needsVerification: false, user }),
    saveProfileName: async (_currentUser, name) => name,
  }
  render(
    <MemoryRouter>
      <AuthProvider authGateway={gateway}>
        <AuthSessionUI />
      </AuthProvider>
    </MemoryRouter>,
  )
  return gateway
}

async function openEmailEditor() {
  await screen.findByText('Alex')
  fireEvent.click(screen.getByText('Alex'))
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
  fireEvent.click(screen.getByRole('button', { name: 'Change email address' }))
}

describe('Profile email change', () => {
  afterEach(cleanup)

  it('keeps the current address until confirmation and shows the requested address as pending', async () => {
    const request = vi.fn(async () => undefined)
    renderProfile(request)
    await openEmailEditor()
    fireEvent.change(screen.getByLabelText('New email address'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation' }))

    expect(
      await screen.findByText(/Confirmation requested for new@example.com/),
    ).toHaveAttribute('role', 'status')
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alex' }),
      'new@example.com',
    )
  })

  it('keeps the draft and gives a safe retry after an error', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('That email cannot be used. Check it or try another.'),
      )
      .mockResolvedValueOnce(undefined)
    renderProfile(request)
    await openEmailEditor()
    fireEvent.change(screen.getByLabelText('New email address'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email cannot be used.',
    )
    expect(screen.getByLabelText('New email address')).toHaveValue(
      'new@example.com',
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send confirmation' }))
    })
    expect(
      await screen.findByText(/Confirmation requested for new@example.com/),
    ).toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(2)
  })
})

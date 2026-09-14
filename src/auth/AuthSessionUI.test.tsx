import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthState } from './AuthContext'
import { AuthSessionUI } from './AuthSessionUI'

function renderSession(initialState?: AuthState) {
  return render(
    <MemoryRouter>
      <AuthProvider initialState={initialState}>
        <AuthSessionUI />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AuthSessionUI', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows a login link when signed out', () => {
    renderSession({ error: null, status: 'signed-out', user: null })

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('shows the user and supports signing out', () => {
    renderSession({
      error: null,
      status: 'signed-in',
      user: { email: 'person@example.com' },
    })

    expect(screen.getByText('Signed in as')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows errors and can retry the local session check', () => {
    vi.useFakeTimers()
    renderSession({
      error: 'Session check failed.',
      status: 'error',
      user: null,
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Session check failed.')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Checking session…')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
  })
})

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthState } from './AuthContext'
import { AuthSessionUI } from './AuthSessionUI'

function LocationProbe() {
  const location = useLocation()

  return <output aria-label="Current route">{location.pathname}</output>
}

function renderSession(initialState?: AuthState, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider initialState={initialState}>
        <AuthSessionUI />
        <LocationProbe />
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
    renderSession(
      {
        error: null,
        status: 'signed-in',
        user: { email: 'person@example.com' },
      },
      ['/today'],
    )

    expect(screen.getByText('Signed in as')).toBeInTheDocument()
    expect(screen.getByText('person@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Current route' }),
    ).toHaveTextContent('/')
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

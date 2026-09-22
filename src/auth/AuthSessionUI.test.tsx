import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthState } from './AuthContext'
import { AuthSessionUI } from './AuthSessionUI'
import { ProtectedRoute } from './ProtectedRoute'

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

  it('shows the user and supports signing out', async () => {
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

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
      expect(
        screen.getByRole('status', { name: 'Current route' }),
      ).toHaveTextContent('/login')
    })
  })

  it('sends logout to login and does not leave a protected route available', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <AuthProvider
          initialState={{
            error: null,
            status: 'signed-in',
            user: { email: 'person@example.com' },
          }}
        >
          <AuthSessionUI />
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/today" element={<p>Protected today</p>} />
            </Route>
            <Route path="/login" element={<p>Login screen</p>} />
          </Routes>
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Protected today')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByText('Login screen')).toBeInTheDocument()
    expect(screen.queryByText('Protected today')).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Current route' }),
    ).toHaveTextContent('/login')
  })

  it('shows errors and can retry the local session check', async () => {
    vi.useFakeTimers()
    renderSession({
      error: 'Session check failed.',
      status: 'error',
      user: null,
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Session check failed.')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Checking session…')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(150)
      await Promise.resolve()
    })

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
  })
})

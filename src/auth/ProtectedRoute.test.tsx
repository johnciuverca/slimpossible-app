import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthState } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

function LoginDestination() {
  const location = useLocation()
  const from = location.state?.from

  return (
    <>
      <h1>Login destination</h1>
      <output aria-label="Return path">
        {from ? `${from.pathname}${from.search}${from.hash}` : 'none'}
      </output>
    </>
  )
}

function ProtectedContent() {
  return <h1>Private content</h1>
}

function renderGuard(initialState: AuthState, initialEntries = ['/today']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider initialState={initialState}>
        <Routes>
          <Route path="/login" element={<LoginDestination />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<ProtectedContent />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('redirects signed-out users to login with a safe return path', () => {
    renderGuard({ error: null, status: 'signed-out', user: null }, [
      '/today?day=1#summary',
    ])

    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Return path' }),
    ).toHaveTextContent('/today?day=1#summary')
  })

  it('renders protected content for signed-in users', () => {
    renderGuard({
      error: null,
      status: 'signed-in',
      user: { email: 'person@example.com' },
    })

    expect(
      screen.getByRole('heading', { name: 'Private content' }),
    ).toBeInTheDocument()
  })

  it('waits for a loading session before deciding access', () => {
    vi.useFakeTimers()
    renderGuard({ error: null, status: 'loading', user: null })

    expect(screen.getByRole('status')).toHaveTextContent('Checking session…')
  })

  it('shows an auth error with a retry action', async () => {
    vi.useFakeTimers()
    renderGuard({ error: 'Session check failed.', status: 'error', user: null })

    expect(screen.getByRole('alert')).toHaveTextContent('Session check failed.')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('status')).toHaveTextContent('Checking session…')

    await act(async () => {
      vi.advanceTimersByTime(150)
      await Promise.resolve()
    })

    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument()
  })
})

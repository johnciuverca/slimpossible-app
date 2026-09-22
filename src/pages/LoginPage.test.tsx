import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { safeInternalPath } from '../auth/authRedirects'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth/AuthContext'

describe('LoginPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('validates required and malformed fields accessibly', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.submit(screen.getByRole('form', { name: 'Login form' }))

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Login form' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('shows configuration guidance without starting a remote request', async () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('keeps post-authentication redirects on an internal route', () => {
    expect(
      safeInternalPath({
        from: { pathname: '//outside.example', search: '?next=1' },
      }),
    ).toBe('/today')
    expect(
      safeInternalPath({
        from: { hash: '#chart', pathname: '/progress', search: '?week=1' },
      }),
    ).toBe('/progress?week=1#chart')
  })

  it('keeps the password-recovery and home links separate and individually targeted', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    const recoveryLink = screen.getByRole('link', {
      name: 'Forgot your password?',
    })
    const homeLink = screen.getByRole('link', { name: 'Back to home' })
    expect(recoveryLink).toHaveAttribute('href', '/forgot-password')
    expect(homeLink).toHaveAttribute('href', '/')
    expect(recoveryLink).toHaveClass('mt-6', 'inline-block')
    expect(homeLink).toHaveClass('mt-6', 'inline-block')
  })
})

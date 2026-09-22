import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'

import { RegisterPage } from './RegisterPage'
import { AuthProvider } from '../auth/AuthContext'

describe('RegisterPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('validates fields and password confirmation accessibly', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.submit(screen.getByRole('form', { name: 'Registration form' }))

    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Create a password.')).toBeInTheDocument()
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Participant' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password321' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Registration form' }))

    expect(screen.getByText('Passwords must match.')).toBeInTheDocument()
  })

  it('shows configuration guidance without starting a remote request', async () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Participant' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('keeps the password-recovery and home links separate and individually targeted', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <RegisterPage />
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

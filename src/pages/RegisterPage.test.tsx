import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { RegisterPage } from './RegisterPage'

describe('RegisterPage', () => {
  afterEach(() => {
    cleanup()
  })

  it('validates fields and password confirmation accessibly', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
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

  it('shows configuration guidance without starting a remote request', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
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

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })
})

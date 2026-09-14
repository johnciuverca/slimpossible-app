import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { AppLayout } from './AppLayout'

describe('AppLayout', () => {
  it('renders accessible landmarks, navigation, and its content slot', () => {
    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <AppLayout>
            <p>Future route content</p>
          </AppLayout>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.getByRole('banner')).toHaveTextContent('Slimpossible')
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Future route content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today',
    )
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppLayout } from './AppLayout'

describe('AppLayout', () => {
  it('renders accessible landmarks, navigation, and its content slot', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <p>Future route content</p>
        </AppLayout>
      </MemoryRouter>,
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

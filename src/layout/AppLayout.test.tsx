import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthState } from '../auth/context'
import { AppLayout } from './AppLayout'

const liveNavigation = [
  { label: 'Overview', path: '/' },
  { label: 'Today', path: '/today' },
  { label: 'My progress', path: '/progress' },
  { label: 'Group', path: '/group' },
  { label: 'Goals', path: '/goals' },
  { label: 'Weigh-in', path: '/weigh-ins' },
]

function renderLayout(path: string, state: AuthState) {
  return render(
    <AuthProvider initialState={state}>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout>
          <p>Live route content</p>
        </AppLayout>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const signedOut: AuthState = { error: null, status: 'signed-out', user: null }

afterEach(() => cleanup())

describe('AppLayout', () => {
  it('renders accessible landmarks and all six existing live destinations', () => {
    renderLayout('/', signedOut)

    expect(screen.getByRole('banner')).toHaveTextContent('Slimpossible')
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Live route content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()

    for (const { label, path } of liveNavigation) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        path,
      )
    }
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it.each(liveNavigation)(
    'identifies $label as the current page without color-only state',
    ({ label, path }) => {
      renderLayout(path, signedOut)

      const currentLink = screen.getByRole('link', { name: label })
      expect(currentLink).toHaveAttribute('aria-current', 'page')
      expect(currentLink).toHaveClass('border-forest-800')
      expect(currentLink).toHaveClass('font-bold')
    },
  )

  it('labels unavailable group history as disabled, without making it a link', () => {
    renderLayout('/group', signedOut)

    const unavailable = screen.getByRole('button', {
      name: 'Group history, coming soon',
    })
    expect(unavailable).toBeDisabled()
    expect(unavailable).toHaveTextContent('Coming soon')
    expect(
      screen.queryByRole('link', { name: /Group history/ }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['signed-out', signedOut],
    [
      'challenge owner',
      {
        error: null,
        status: 'signed-in',
        user: { email: 'owner@example.com', id: 'owner-1' },
      } satisfies AuthState,
    ],
    [
      'joined member',
      {
        error: null,
        status: 'signed-in',
        user: { email: 'member@example.com', id: 'member-1' },
      } satisfies AuthState,
    ],
  ])('keeps live navigation available for a %s', (_role, state) => {
    renderLayout('/today', state)

    for (const { label } of liveNavigation) {
      expect(
        screen.getByRole('link', { name: new RegExp(label) }),
      ).toBeVisible()
    }
  })
})

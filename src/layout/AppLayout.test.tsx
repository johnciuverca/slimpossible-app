import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthState } from '../auth/context'
import { AppLayout } from './AppLayout'

const liveNavigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Challenges', path: '/challenges' },
  { label: 'My progress', path: '/progress' },
  { label: 'Group', path: '/group' },
  { label: 'Goals', path: '/goals' },
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

function CurrentRoute() {
  const location = useLocation()

  return (
    <output data-testid="current-route">
      {location.pathname}
      {location.search}
    </output>
  )
}

const signedOut: AuthState = { error: null, status: 'signed-out', user: null }

afterEach(() => cleanup())

describe('AppLayout', () => {
  it('renders retained destinations without standalone Weigh-in navigation', () => {
    renderLayout('/', signedOut)

    expect(screen.getByRole('banner')).toHaveTextContent('Slimpossible')
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Live route content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Weigh-in' }),
    ).not.toBeInTheDocument()

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

  it('preserves the selected challenge across shared header navigation', () => {
    render(
      <AuthProvider initialState={signedOut}>
        <MemoryRouter
          initialEntries={[
            '/challenge/participants/enroll?challenge=private%2Fplan',
          ]}
        >
          <AppLayout>
            <CurrentRoute />
          </AppLayout>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.getByRole('link', { name: 'Slimpossible' })).toHaveAttribute(
      'href',
      '/?challenge=private%2Fplan',
    )

    for (const { label, path } of liveNavigation) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        ['/dashboard', '/progress', '/weigh-ins'].includes(path)
          ? path
          : `${path}?challenge=private%2Fplan`,
      )
    }

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(screen.getByTestId('current-route')).toHaveTextContent('/dashboard')
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

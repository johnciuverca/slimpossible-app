import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthState } from '../auth/context'
import { AppLayout } from './AppLayout'

const liveNavigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Group', path: '/group' },
]

function renderLayout(path: string, state: AuthState) {
  return render(
    <AuthProvider initialState={state}>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout>
          <p>Live route content</p>
          <CurrentRoute />
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
const signedIn: AuthState = {
  error: null,
  status: 'signed-in',
  user: { id: 'owner-1', email: 'owner@example.invalid' },
}

afterEach(() => cleanup())

describe('AppLayout', () => {
  it.each([
    [
      'signed-in',
      {
        error: null,
        status: 'signed-in',
        user: { id: 'owner-1', email: 'owner@example.invalid' },
      } satisfies AuthState,
      '/dashboard',
    ],
    ['signed-out', signedOut, '/'],
  ])(
    'the %s logo opens its canonical home without challenge parameters',
    (_label, state, destination) => {
      renderLayout('/group?challenge=private%2Fplan&tab=progress', state)
      const logo = screen.getByRole('link', { name: 'Slimpossible' })
      expect(logo).toHaveAttribute('href', destination)
      fireEvent.click(logo)
      expect(screen.getByTestId('current-route').textContent).toBe(destination)
    },
  )
  it('renders only the actual Dashboard and Group workspaces in primary navigation', () => {
    renderLayout('/dashboard', signedIn)

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
    for (const retired of ['Challenges', 'My progress', 'Goals']) {
      expect(
        screen.queryByRole('link', { name: retired }),
      ).not.toBeInTheDocument()
    }
  })

  it('uses the Dashboard shell for signed-in root without changing public or challenge routes', () => {
    const { unmount } = renderLayout('/', signedIn)

    const dashboardShell = document.querySelector('.app-shell')
    expect(dashboardShell).toHaveClass('shared-layout', 'dashboard-shell')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()

    unmount()
    renderLayout('/', signedOut)
    expect(document.querySelector('.app-shell')).not.toHaveClass(
      'shared-layout',
      'dashboard-shell',
    )
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    )

    cleanup()
    renderLayout('/?challenge=private%2Fplan', signedIn)
    expect(document.querySelector('.app-shell')).not.toHaveClass(
      'shared-layout',
      'dashboard-shell',
    )
  })

  it.each(['/login', '/register'])(
    'shows public navigation without protected controls on %s',
    (path) => {
      renderLayout(path, signedOut)
      for (const [name, href] of [
        ['Home', '/'],
        ['Log in', '/login'],
        ['Register', '/register'],
      ]) {
        expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
      }
      for (const name of ['Dashboard', 'Group', 'Profile', 'Log out']) {
        expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
    },
  )

  it('preserves the selected challenge across shared header navigation', () => {
    render(
      <AuthProvider initialState={signedIn}>
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
      '/dashboard',
    )

    for (const { label, path } of liveNavigation) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        ['/dashboard', '/weigh-ins'].includes(path)
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
      renderLayout(path, signedIn)

      const currentLink = screen.getByRole('link', { name: label })
      expect(currentLink).toHaveAttribute('aria-current', 'page')
      expect(currentLink).toHaveClass('border-forest-800')
      expect(currentLink).toHaveClass('font-bold')
    },
  )

  it('does not add a duplicate or unavailable Group history destination', () => {
    renderLayout('/group', signedOut)

    expect(
      screen.queryByRole('button', { name: /Group history/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Group history/ }),
    ).not.toBeInTheDocument()
  })

  it.each([
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

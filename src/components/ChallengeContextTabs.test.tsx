import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChallengeTabs, ChallengeContextTabs } from './ChallengeContextTabs'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../models/fixtures'
import { AuthContext, type AuthContextValue } from '../auth/context'
import { createPersistence } from '../data/persistence'
import * as persistenceModule from '../data/persistence'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
const group = createChallengeFixture({ id: 'group', name: 'Joined group' })
const personal = createChallengeFixture({
  id: 'personal',
  name: 'Personal goal',
  kind: 'personal',
  ownerId: 'user-alex',
})
function Route() {
  const location = useLocation()
  return (
    <output>
      {location.pathname}
      {location.search}
    </output>
  )
}
function auth(id: string): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: { id, email: `${id}@example.invalid` },
      error: null,
    },
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => false,
    retrySession: () => undefined,
  }
}

describe('Challenge context navigation', () => {
  it.each(['/dashboard', '/today'])(
    'keeps %s personal and routes challenge links to explicit progress',
    (path) => {
      render(
        <MemoryRouter initialEntries={[`${path}?challenge=group`]}>
          <ChallengeTabs challenges={[group, personal]} />
          <Route />
        </MemoryRouter>,
      )
      expect(
        screen.getByRole('link', { name: /Personal tracking/ }),
      ).toHaveAttribute('aria-current', 'page')
      expect(
        screen.getByRole('link', { name: 'Group · Joined group' }),
      ).toHaveAttribute('href', '/progress?challenge=group')
      fireEvent.click(
        screen.getByRole('link', { name: 'Personal · Personal goal' }),
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        '/progress?challenge=personal',
      )
    },
  )
  it.each(['/progress', '/challenges', '/goals', '/weigh-ins'])(
    'preserves %s when meaningful with highlighted link semantics',
    (path) => {
      render(
        <MemoryRouter initialEntries={[`${path}?challenge=group`]}>
          <ChallengeTabs challenges={[group, personal]} />
        </MemoryRouter>,
      )
      expect(
        screen.getByRole('link', { name: /Group · Joined group/ }),
      ).toHaveAttribute('aria-current', 'page')
      expect(
        screen.getByRole('link', { name: 'Personal · Personal goal' }),
      ).toHaveAttribute('href', `${path}?challenge=personal`)
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    },
  )
  it('routes a personal challenge out of Group without implying a shared dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/group?challenge=group']}>
        <ChallengeTabs challenges={[group, personal]} />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('link', { name: 'Personal · Personal goal' }),
    ).toHaveAttribute('href', '/progress?challenge=personal')
    expect(
      screen.getByRole('link', { name: 'Personal tracking' }),
    ).toHaveAttribute('href', '/dashboard')
  })
  it('lists only owned/active-joined contexts and hides previous-account contexts on switch', async () => {
    localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        group,
        personal,
        createChallengeFixture({
          id: 'other',
          name: 'Other account context',
          ownerId: 'second',
        }),
      ]),
    )
    localStorage.setItem(
      'slimpossible.local.participants',
      JSON.stringify([createParticipantFixture({ challengeId: 'group' })]),
    )
    const tree = (id: string) => (
      <AuthContext.Provider value={auth(id)}>
        <MemoryRouter initialEntries={['/progress']}>
          <ChallengeContextTabs />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    const view = render(tree('user-alex'))
    await screen.findByRole('link', { name: 'Group · Joined group' })
    expect(
      screen.queryByRole('link', { name: /Other account/ }),
    ).not.toBeInTheDocument()
    view.rerender(tree('second'))
    expect(
      screen.queryByRole('link', { name: /Joined group/ }),
    ).not.toBeInTheDocument()
    await screen.findByRole('link', { name: 'Group · Other account context' })
    expect(
      screen.queryByRole('link', { name: /Personal goal/ }),
    ).not.toBeInTheDocument()
  })
  it('shows loading, error and unavailable selection without blocking personal navigation', async () => {
    const persistence = createPersistence(auth('user-alex').state)
    if (persistence.mode !== 'local') throw new Error('Expected local')
    vi.spyOn(
      persistence.repositories.challenges,
      'listVisibleToUser',
    ).mockRejectedValue(new Error('fixture error'))
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(
      persistence,
    )
    render(
      <AuthContext.Provider value={auth('user-alex')}>
        <MemoryRouter initialEntries={['/progress?challenge=unavailable']}>
          <ChallengeContextTabs />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading authorized')
    await screen.findByRole('alert')
    expect(
      screen.getByRole('link', { name: 'Personal tracking' }),
    ).toHaveAttribute('href', '/progress')
  })
})

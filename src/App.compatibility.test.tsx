import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './auth/AuthContext'
import * as persistenceModule from './data/persistence'
import type { createPersistence } from './data/persistence'
import { WorkspaceCompatibilityRoute } from './App'

const authState = {
  error: null,
  status: 'signed-in' as const,
  user: { email: 'member@example.com', id: 'member-1' },
}

function CurrentLocation() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}

function renderRoute(
  initialEntry: string,
  destination: 'challenge' | 'goals' | 'progress' | 'today',
) {
  render(
    <AuthProvider initialState={authState}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="*"
            element={<WorkspaceCompatibilityRoute destination={destination} />}
          />
          <Route path="/dashboard" element={<CurrentLocation />} />
          <Route path="/group" element={<CurrentLocation />} />
          <Route
            path="/challenge/participants/enroll"
            element={<CurrentLocation />}
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function mockEligibleContexts() {
  vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue({
    mode: 'remote',
    repositories: {
      challenges: {
        listVisibleToUser: vi.fn().mockResolvedValue({
          state: 'success',
          data: [
            { id: 'group-one', kind: 'group', ownerId: 'someone-else' },
            { id: 'personal-one', kind: 'personal', ownerId: 'someone-else' },
            { id: 'owned-group', kind: 'group', ownerId: 'member-1' },
            { id: 'owned-personal', kind: 'personal', ownerId: 'member-1' },
          ],
        }),
      },
      participants: {
        listForUser: vi.fn().mockResolvedValue({
          state: 'success',
          data: [
            { challengeId: 'group-one', status: 'active' },
            { challengeId: 'personal-one', status: 'active' },
          ],
        }),
      },
    },
  } as unknown as ReturnType<typeof createPersistence>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('legacy workspace navigation', () => {
  it('opens an eligible selected Group and preserves safe query and hash', async () => {
    mockEligibleContexts()
    renderRoute(
      '/challenges?challenge=group-one&source=legacy#members',
      'challenge',
    )
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/group?challenge=group-one&source=legacy#members',
      ),
    )
  })

  it('opens eligible personal challenges in Dashboard Overview, not Group', async () => {
    mockEligibleContexts()
    renderRoute(
      '/challenges?challenge=personal-one&view=old#goals',
      'challenge',
    )
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=personal-one&view=old&tab=overview#goals',
      ),
    )
  })

  it('aliases Progress and Goals to Dashboard Overview with Goals addressable', async () => {
    mockEligibleContexts()
    renderRoute('/goals?challenge=group-one&filter=recent', 'goals')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=group-one&filter=recent&tab=overview#goals',
      ),
    )
  })

  it('keeps /today on personal Overview while preserving its query and hash', async () => {
    mockEligibleContexts()
    renderRoute('/today?challenge=group-one&day=recent#overview', 'today')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=group-one&day=recent&tab=overview#overview',
      ),
    )
  })

  it('normalizes a stale Today tab to Overview while retaining other context', async () => {
    mockEligibleContexts()
    renderRoute(
      '/today?tab=progress&challenge=group-one&source=old#overview',
      'today',
    )
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?tab=overview&challenge=group-one&source=old#overview',
      ),
    )
  })

  it('keeps an owner-only Group challenge on its management workspace', async () => {
    mockEligibleContexts()
    renderRoute('/challenges?challenge=owned-group&source=old', 'challenge')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/group?challenge=owned-group&source=old',
      ),
    )
  })

  it('preserves the owner self-enrollment action for a private challenge', async () => {
    mockEligibleContexts()
    renderRoute('/challenges?challenge=owned-personal&source=old', 'challenge')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/challenge/participants/enroll?challenge=owned-personal&source=old&self=owner',
      ),
    )
  })

  it('does not expose owner-only challenge context in personal Overview', async () => {
    mockEligibleContexts()
    renderRoute('/progress?challenge=owned-personal', 'progress')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?tab=overview&navigation=challenge-unavailable',
      ),
    )
  })

  it('fails closed for unavailable challenges and provides safe Dashboard guidance', async () => {
    mockEligibleContexts()
    renderRoute('/challenges?challenge=outsider-group&source=old', 'challenge')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?source=old&navigation=challenge-unavailable',
      ),
    )
  })
})

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
            { id: 'group-one', kind: 'group' },
            { id: 'personal-one', kind: 'personal' },
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

  it('opens eligible personal challenges in personal Progress, not Group', async () => {
    mockEligibleContexts()
    renderRoute(
      '/challenges?challenge=personal-one&view=old#goals',
      'challenge',
    )
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=personal-one&view=old&tab=progress#goals',
      ),
    )
  })

  it('aliases Progress and Goals to Dashboard Progress with Goals addressable', async () => {
    mockEligibleContexts()
    renderRoute('/goals?challenge=group-one&filter=recent', 'goals')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=group-one&filter=recent&tab=progress#goals',
      ),
    )
  })

  it('keeps /today on personal Overview while preserving its query and hash', async () => {
    mockEligibleContexts()
    renderRoute('/today?challenge=group-one&day=recent#overview', 'today')
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/dashboard?challenge=group-one&day=recent#overview',
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

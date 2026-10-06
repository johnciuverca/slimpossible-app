import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext, type AuthContextValue } from '../auth/context'
import { ProgressPage } from './AppPages'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const challenges = [
  {
    created_at: '2026-09-17T10:00:00.000Z',
    created_by: 'owner-1',
    description: null,
    end_date: '2026-10-17',
    id: 'challenge-1',
    name: 'First challenge',
    owner_id: 'owner-1',
    start_date: '2026-09-17',
    status: 'active',
    target_weight_kg: null,
    updated_at: '2026-09-17T10:00:00.000Z',
  },
  {
    created_at: '2026-09-17T10:00:00.000Z',
    created_by: 'owner-2',
    description: null,
    end_date: '2026-10-17',
    id: 'challenge-2',
    name: 'Second challenge',
    owner_id: 'owner-2',
    start_date: '2026-09-17',
    status: 'active',
    target_weight_kg: null,
    updated_at: '2026-09-17T10:00:00.000Z',
  },
]

const participants = [
  {
    challenge_id: 'challenge-1',
    created_at: '2026-09-17T10:00:00.000Z',
    display_name: 'Member one',
    id: 'participant-1a',
    joined_at: '2026-09-17T10:00:00.000Z',
    starting_weight_kg: 100,
    status: 'active',
    target_weight_kg: 80,
    updated_at: '2026-09-17T10:00:00.000Z',
    user_id: 'member-1',
  },
  {
    challenge_id: 'challenge-2',
    created_at: '2026-09-17T10:00:00.000Z',
    display_name: 'Member one',
    id: 'participant-1b',
    joined_at: '2026-09-17T10:00:00.000Z',
    starting_weight_kg: 100,
    status: 'active',
    target_weight_kg: 80,
    updated_at: '2026-09-17T10:00:00.000Z',
    user_id: 'member-1',
  },
  {
    challenge_id: 'challenge-2',
    created_at: '2026-09-17T10:00:00.000Z',
    display_name: 'Member two',
    id: 'participant-2b',
    joined_at: '2026-09-17T10:00:00.000Z',
    starting_weight_kg: 90,
    status: 'active',
    target_weight_kg: 75,
    updated_at: '2026-09-17T10:00:00.000Z',
    user_id: 'member-2',
  },
]

const weighIns = [
  {
    created_at: '2026-09-17T10:00:00.000Z',
    id: 'record-1a',
    note: 'First challenge private note',
    participant_id: 'participant-1a',
    recorded_date: '2026-09-18',
    updated_at: '2026-09-18T10:00:00.000Z',
    weight_kg: 90,
  },
  {
    created_at: '2026-09-17T10:00:00.000Z',
    id: 'record-1b',
    note: 'Second challenge private note',
    participant_id: 'participant-1b',
    recorded_date: '2026-09-19',
    updated_at: '2026-09-19T10:00:00.000Z',
    weight_kg: 88,
  },
  {
    created_at: '2026-09-17T10:00:00.000Z',
    id: 'record-2b',
    note: 'Second account private note',
    participant_id: 'participant-2b',
    recorded_date: '2026-09-20',
    updated_at: '2026-09-20T10:00:00.000Z',
    weight_kg: 70,
  },
]

function authValue(userId: string): AuthContextValue {
  return {
    requestPasswordRecovery: vi.fn(),
    resetPassword: vi.fn().mockResolvedValue(false),
    retrySession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
    state: {
      error: null,
      status: 'signed-in',
      user: { email: `${userId}@example.invalid`, id: userId },
    },
  }
}

function installRemoteFixtures({ emptyWeighIns = false } = {}) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://progress-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/challenges?'))
        return Promise.resolve(response(challenges))
      if (url.includes('/participants?')) {
        const userId = url.includes('user_id=eq.member-2')
          ? 'member-2'
          : 'member-1'
        return Promise.resolve(
          response(participants.filter(({ user_id }) => user_id === userId)),
        )
      }
      if (url.includes('/weigh_ins?')) {
        if (emptyWeighIns) return Promise.resolve(response([]))
        const participantId = url.match(/participant_id=eq\.([^&]+)/)?.[1]
        return Promise.resolve(
          response(
            weighIns.filter(
              ({ participant_id }) => participant_id === participantId,
            ),
          ),
        )
      }
      return Promise.resolve(response([]))
    }),
  )
}

function ProgressRoutes() {
  return (
    <Routes>
      <Route
        path="/progress"
        element={
          <>
            <Link to="/progress?challenge=challenge-2">
              Select the second challenge
            </Link>
            <ProgressPage />
          </>
        }
      />
    </Routes>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ProgressPage', () => {
  it('shows an honest no-record state without inventing a chart or weekly change', async () => {
    installRemoteFixtures({ emptyWeighIns: true })
    render(
      <AuthContext.Provider value={authValue('member-1')}>
        <MemoryRouter initialEntries={['/progress?challenge=challenge-1']}>
          <ProgressPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      await screen.findByText(/No weigh-ins saved yet/),
    ).toBeInTheDocument()
    expect(screen.getByText('No record yet')).toBeInTheDocument()
    expect(
      screen.getByText('No saved check-in this week yet.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /weight history chart/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('table', { name: 'Your saved personal weigh-ins' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Group history')).toBeInTheDocument()
    expect(screen.getByText('Coming in Chapter 16')).toBeInTheDocument()
  })

  it('clears prior challenge history and displays only the selected challenge records', async () => {
    installRemoteFixtures()
    render(
      <AuthContext.Provider value={authValue('member-1')}>
        <MemoryRouter initialEntries={['/progress?challenge=challenge-1']}>
          <ProgressRoutes />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      await screen.findByText('First challenge private note'),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('link', { name: 'Select the second challenge' }),
    )

    expect(
      await screen.findByText('Second challenge private note'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('First challenge private note'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Group · Second challenge')).toBeInTheDocument()
  })

  it('removes one account’s history before showing another account’s selected history', async () => {
    installRemoteFixtures()
    const { rerender } = render(
      <AuthContext.Provider value={authValue('member-1')}>
        <MemoryRouter initialEntries={['/progress?challenge=challenge-2']}>
          <ProgressPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      await screen.findByText('Second challenge private note'),
    ).toBeInTheDocument()
    rerender(
      <AuthContext.Provider value={authValue('member-2')}>
        <MemoryRouter initialEntries={['/progress?challenge=challenge-2']}>
          <ProgressPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      screen.queryByText('Second challenge private note'),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText('Second account private note'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('First challenge private note'),
    ).not.toBeInTheDocument()
  })

  it('keeps group history explicitly unavailable and non-actionable', async () => {
    installRemoteFixtures()
    render(
      <AuthContext.Provider value={authValue('member-1')}>
        <MemoryRouter initialEntries={['/progress?challenge=challenge-1']}>
          <ProgressPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    const placeholder = await screen.findByRole('region', {
      name: 'Group history',
    })
    expect(placeholder).toHaveTextContent('Coming in Chapter 16')
    expect(placeholder).toHaveTextContent('other participants’ histories')
    expect(placeholder.querySelectorAll('a, button')).toHaveLength(0)
  })
})

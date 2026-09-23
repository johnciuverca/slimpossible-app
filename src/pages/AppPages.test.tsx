import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { GoalsPage, HomePage, ProgressPage, TodayPage } from './AppPages'

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

function renderSignedIn(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://home-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)

  render(
    <AuthProvider
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: 'member@example.com', id: 'member-1' },
      }}
    >
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

function dashboardResponses(challengeOwnerId = 'member-1') {
  return [
    response([
      {
        created_at: '2026-09-17T10:00:00.000Z',
        created_by: 'member-1',
        description: null,
        end_date: '2026-10-01',
        id: 'challenge-1',
        name: 'Autumn challenge',
        owner_id: challengeOwnerId,
        start_date: '2026-09-17',
        status: 'active',
        target_weight_kg: null,
        updated_at: '2026-09-17T10:00:00.000Z',
      },
    ]),
    response([
      {
        challenge_id: 'challenge-1',
        created_at: '2026-09-17T10:00:00.000Z',
        display_name: 'Saved member',
        id: 'participant-1',
        joined_at: '2026-09-17T10:00:00.000Z',
        starting_weight_kg: 100,
        status: 'active',
        target_weight_kg: 80,
        updated_at: '2026-09-17T10:00:00.000Z',
        user_id: 'member-1',
      },
    ]),
    response([
      {
        created_at: '2026-09-17T10:00:00.000Z',
        id: 'weigh-in-1',
        note: null,
        participant_id: 'participant-1',
        recorded_date: '2026-09-17',
        updated_at: '2026-09-17T10:00:00.000Z',
        weight_kg: 95,
      },
      {
        created_at: '2026-09-18T10:00:00.000Z',
        id: 'weigh-in-2',
        note: null,
        participant_id: 'participant-1',
        recorded_date: '2026-09-18',
        updated_at: '2026-09-18T10:00:00.000Z',
        weight_kg: 90,
      },
    ]),
  ]
}

function renderDashboard(
  page: React.ReactNode,
  fetchMock: ReturnType<typeof vi.fn>,
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://home-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthProvider
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: 'member@example.com', id: 'member-1' },
      }}
    >
      <MemoryRouter initialEntries={['/today?challenge=challenge-1']}>
        {page}
      </MemoryRouter>
    </AuthProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('guides a signed-in first-time user to challenge setup', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([]))
    renderSignedIn(fetchMock)

    await waitFor(() => {
      expect(
        screen.getByText(
          'No saved challenge is available for this account yet.',
        ),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('link', { name: 'Set up a challenge' }),
    ).toHaveAttribute('href', '/challenge/setup')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('lets a returning user select a saved challenge for account navigation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response([
        {
          created_at: '2026-09-17T10:00:00.000Z',
          created_by: 'member-1',
          description: null,
          end_date: '2026-10-01',
          id: 'challenge-1',
          name: 'Autumn challenge',
          owner_id: 'member-1',
          start_date: '2026-09-17',
          status: 'active',
          target_weight_kg: null,
          updated_at: '2026-09-17T10:00:00.000Z',
        },
        {
          created_at: '2026-09-18T10:00:00.000Z',
          created_by: 'member-1',
          description: null,
          end_date: '2026-11-01',
          id: 'challenge-2',
          name: 'Winter challenge',
          owner_id: 'member-1',
          start_date: '2026-10-01',
          status: 'draft',
          target_weight_kg: null,
          updated_at: '2026-09-18T10:00:00.000Z',
        },
      ]),
    )
    renderSignedIn(fetchMock)

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Autumn challenge' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today?challenge=challenge-1',
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'challenge-2' },
    })
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute(
      'href',
      '/progress?challenge=challenge-2',
    )
    expect(screen.getByRole('link', { name: 'Goals' })).toHaveAttribute(
      'href',
      '/goals?challenge=challenge-2',
    )
    const challengeRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/challenges?'),
    )
    expect(String(challengeRequest?.[0])).not.toContain('owner_id=')
  })

  it('shows a joined challenge even when the signed-in member does not own it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response([
        {
          created_at: '2026-09-17T10:00:00.000Z',
          created_by: 'owner-1',
          description: null,
          end_date: '2026-10-01',
          id: 'joined-challenge',
          name: 'Owner hosted challenge',
          owner_id: 'owner-1',
          start_date: '2026-09-17',
          status: 'active',
          target_weight_kg: null,
          updated_at: '2026-09-17T10:00:00.000Z',
        },
      ]),
    )
    renderSignedIn(fetchMock)

    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'Owner hosted challenge' }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today?challenge=joined-challenge',
    )
  })

  it('keeps the public foundation separate from signed-in challenge data', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Your challenge starts here.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Public preview')).toBeInTheDocument()
    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument()
  })

  it('renders Today from the selected participant and saved weigh-ins', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    renderDashboard(<TodayPage />, fetchMock)

    await waitFor(() => expect(screen.getByText('90 kg')).toBeInTheDocument())
    expect(screen.getByText('100 kg')).toBeInTheDocument()
    expect(screen.getByText('80 kg')).toBeInTheDocument()
    expect(
      screen.getByText('You are 10 kg away from your target weight.'),
    ).toBeInTheDocument()
  })

  it('renders saved history and trend on Progress', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    renderDashboard(<ProgressPage />, fetchMock)

    await waitFor(() => {
      const historyItems = screen.getAllByRole('listitem')
      expect(historyItems[0]).toHaveTextContent('2026-09-18: 90 kg')
      expect(historyItems[1]).toHaveTextContent('2026-09-17: 95 kg')
    })
    expect(screen.getByText('Trend: -5 kg')).toBeInTheDocument()
  })

  it('renders milestones from saved target progress on Goals', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    renderDashboard(<GoalsPage />, fetchMock)

    await waitFor(() =>
      expect(
        screen.getByRole('progressbar', {
          name: 'Milestone progress: 50% complete',
        }),
      ).toBeInTheDocument(),
    )
  })

  it.each([
    ['Today', <TodayPage />],
    ['Progress', <ProgressPage />],
    ['Goals', <GoalsPage />],
  ])(
    'loads a joined challenge with no owned challenge on %s',
    async (_, page) => {
      const fetchMock = vi.fn()
      dashboardResponses('owner-1').forEach((item) =>
        fetchMock.mockResolvedValueOnce(item),
      )
      renderDashboard(page, fetchMock)

      await waitFor(() =>
        expect(screen.getByText('Autumn challenge')).toBeInTheDocument(),
      )
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('participant_id=eq.participant-1'),
        ),
      ).toBe(true)
      const challengeRequest = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/challenges?'),
      )
      expect(String(challengeRequest?.[0])).not.toContain('owner_id=')
    },
  )
})

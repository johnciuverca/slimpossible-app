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
import { AuthContext, type AuthContextValue } from '../auth/context'
import {
  GoalsPage,
  GroupDashboardPage,
  HomePage,
  ProgressPage,
  TodayPage,
} from './AppPages'
import { mostRecentSunday } from '../models/groupProgress'
import { localDateOnly } from '../models/provisionalGroupLeader'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function renderSignedIn(
  fetchMock: ReturnType<typeof vi.fn>,
  initialEntry = '/',
  userId = 'member-1',
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://home-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)

  render(
    <AuthProvider
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: 'member@example.com', id: userId },
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
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
  initialEntry = '/today?challenge=challenge-1',
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
      <MemoryRouter initialEntries={[initialEntry]}>{page}</MemoryRouter>
    </AuthProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('shows a session-loading state while authentication is being restored', () => {
    const contextValue: AuthContextValue = {
      requestPasswordRecovery: vi.fn(),
      resetPassword: vi.fn().mockResolvedValue(false),
      retrySession: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      state: { error: null, status: 'loading', user: null },
    }
    render(
      <AuthContext.Provider value={contextValue}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking your saved session…',
    )
  })

  it('shows an accessible error state when saved challenges cannot load', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo) =>
        String(input).includes('/challenges?')
          ? response({ message: 'Remote request failed' }, 500)
          : response([]),
      )
    renderSignedIn(fetchMock)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your challenges could not be loaded. Try refreshing.',
    )
  })

  it('guides a signed-in first-time user to challenge setup', async () => {
    const fetchMock = vi.fn().mockImplementation(() => response([]))
    renderSignedIn(fetchMock)

    expect(
      await screen.findByText(/No saved challenge is available/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Set up a challenge' }),
    ).toHaveAttribute('href', '/challenge/setup')
    expect(
      screen.queryByRole('link', { name: 'Today' }),
    ).not.toBeInTheDocument()
  })

  it('shows owner enrollment and invite actions without member-only destinations', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
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
      ]),
    )
    fetchMock.mockResolvedValueOnce(response([]))
    renderSignedIn(fetchMock)

    const enroll = await screen.findByRole('link', {
      name: 'Enroll yourself',
    })
    expect(enroll).toHaveAttribute(
      'href',
      '/challenge/participants/enroll?challenge=challenge-1&self=owner',
    )
    expect(
      screen.getByRole('link', { name: 'Invite participants' }),
    ).toHaveAttribute('href', '/challenge/invites?challenge=challenge-1')
    expect(
      screen.queryByRole('link', { name: 'Today' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Weekly group comparison'),
    ).not.toBeInTheDocument()
  })

  it('shows actual personal and permitted group summaries to a joined member, but no owner actions', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
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
    fetchMock.mockResolvedValueOnce(
      response([
        {
          challenge_id: 'joined-challenge',
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
    )
    fetchMock.mockResolvedValueOnce(
      response([
        {
          created_at: '2026-09-17T10:00:00.000Z',
          id: 'private-weigh-in',
          note: 'Private note content',
          participant_id: 'participant-1',
          recorded_date: '2026-09-17',
          updated_at: '2026-09-17T10:00:00.000Z',
          weight_kg: 95,
        },
        {
          created_at: '2026-09-18T10:00:00.000Z',
          id: 'latest-weigh-in',
          note: null,
          participant_id: 'participant-1',
          recorded_date: '2026-09-18',
          updated_at: '2026-09-18T10:00:00.000Z',
          weight_kg: 90,
        },
      ]),
    )
    fetchMock.mockResolvedValueOnce(
      response([
        {
          active_participant_count: 3,
          average_completion_percentage: 25,
          challenge_id: 'joined-challenge',
          current_sunday: mostRecentSunday(),
          eligible_participant_count: 2,
          participants_with_progress_count: 2,
          participants_with_recorded_weight_count: 3,
          previous_sunday: '2026-09-20',
          reached_target_count: 0,
          weekly_winner_count: 1,
          weekly_winner_names: ['Not shown on Home'],
        },
      ]),
    )
    renderSignedIn(fetchMock)

    expect(
      await screen.findByRole('button', { name: /Owner hosted challenge/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('90 kg')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(screen.queryByText('Private note content')).not.toBeInTheDocument()
    expect(screen.queryByText('Not shown on Home')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today?challenge=joined-challenge',
    )
    expect(
      screen.queryByRole('link', { name: 'Invite participants' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Set up another challenge' }),
    ).not.toBeInTheDocument()
  })

  it('preserves a directly loaded selection and updates navigation when changed', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(
      response([
        {
          created_at: '2026-09-18T10:00:00.000Z',
          created_by: 'member-1',
          description: null,
          end_date: '2026-10-01',
          id: 'challenge-1',
          name: 'Autumn challenge',
          owner_id: 'member-1',
          start_date: '2026-09-17',
          status: 'active',
          target_weight_kg: null,
          updated_at: '2026-09-18T10:00:00.000Z',
        },
        {
          created_at: '2026-09-17T10:00:00.000Z',
          created_by: 'member-1',
          description: null,
          end_date: '2026-10-01',
          id: 'challenge-2',
          name: 'Winter challenge',
          owner_id: 'member-1',
          start_date: '2026-09-17',
          status: 'active',
          target_weight_kg: null,
          updated_at: '2026-09-17T10:00:00.000Z',
        },
      ]),
    )
    fetchMock.mockResolvedValueOnce(response([]))
    renderSignedIn(fetchMock, '/?challenge=challenge-2')

    const winter = await screen.findByRole('button', {
      name: /Winter challenge/,
    })
    expect(winter).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('link', { name: 'Enroll yourself' }),
    ).toHaveAttribute(
      'href',
      '/challenge/participants/enroll?challenge=challenge-2&self=owner',
    )
    fireEvent.click(screen.getByRole('button', { name: /Autumn challenge/ }))
    expect(
      screen.getByRole('button', { name: /Autumn challenge/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('link', { name: 'Enroll yourself' }),
    ).toHaveAttribute(
      'href',
      '/challenge/participants/enroll?challenge=challenge-1&self=owner',
    )
  })

  it('keeps the signed-out welcome path on login and registration', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Keep showing up. It adds up.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(
      screen.getByRole('link', { name: 'Create your account' }),
    ).toHaveAttribute('href', '/register')
    expect(
      screen.queryByRole('link', { name: 'Set up a challenge' }),
    ).not.toBeInTheDocument()
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
    expect(
      screen.queryByRole('heading', { name: 'No challenge yet' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Set up a challenge' }),
    ).not.toBeInTheDocument()
  })

  it('offers an owner a direct enrollment action for the selected Today challenge', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(dashboardResponses()[0])
    fetchMock.mockResolvedValueOnce(response([]))
    renderDashboard(<TodayPage />, fetchMock)

    expect(
      await screen.findByText(
        'Enroll yourself in the selected challenge before viewing your dashboard.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Enroll yourself' }),
    ).toHaveAttribute(
      'href',
      '/challenge/participants/enroll?challenge=challenge-1',
    )
  })

  it('shows a keyboard-accessible setup action on Today when no challenge exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([]))
    renderDashboard(<TodayPage />, fetchMock)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'No challenge yet' }),
      ).toBeInTheDocument(),
    )
    const setupLink = screen.getByRole('link', { name: 'Set up a challenge' })
    expect(setupLink).toHaveAttribute('href', '/challenge/setup')
    expect(setupLink).toHaveProperty('tabIndex', 0)
  })

  it('renders saved history and trend on Progress', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    fetchMock.mockResolvedValueOnce(response([]))
    renderDashboard(<ProgressPage />, fetchMock)

    await waitFor(() => {
      const historyItems = screen.getAllByRole('listitem')
      expect(historyItems[0]).toHaveTextContent('2026-09-18: 90 kg')
      expect(historyItems[1]).toHaveTextContent('2026-09-17: 95 kg')
    })
    expect(screen.getByText('Trend: -5 kg')).toBeInTheDocument()
  })

  it('shows the provisional shared leader from the authorized RPC only', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    fetchMock.mockResolvedValueOnce(
      response([
        {
          active_participant_count: 3,
          challenge_id: 'challenge-1',
          current_week_end: '2026-09-20',
          current_week_start: '2026-09-14',
          eligible_participant_count: 2,
          leader_count: 2,
          leader_latest_dates: ['2026-09-20', '2026-09-18'],
          leader_names: ['Ava', 'Ben'],
          previous_sunday: '2026-09-13',
          state: 'leaders',
        },
      ]),
    )
    renderDashboard(
      <ProgressPage />,
      fetchMock,
      '/progress?challenge=challenge-1',
    )

    expect(
      await screen.findByRole('heading', {
        name: 'This week’s provisional leader',
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Ava/)).toHaveTextContent(
      'latest check-in 2026-09-20',
    )
    expect(await screen.findByText(/Ben/)).toHaveTextContent(
      'latest check-in 2026-09-18',
    )
    expect(screen.getByText(/2 of 3 active participants/)).toBeInTheDocument()
    const rpcRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/rpc/get_provisional_group_leader_summary'),
    )
    expect(JSON.parse(String(rpcRequest?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
      target_current_date: localDateOnly(),
    })
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/weigh_ins?'),
      ),
    ).toHaveLength(1)
  })

  it('explains missing comparison check-ins and hides a solo challenge', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    fetchMock.mockResolvedValueOnce(
      response([
        {
          active_participant_count: 2,
          challenge_id: 'challenge-1',
          current_week_end: '2026-09-20',
          current_week_start: '2026-09-14',
          eligible_participant_count: 0,
          leader_count: 0,
          leader_latest_dates: [],
          leader_names: [],
          previous_sunday: '2026-09-13',
          state: 'no-eligible-candidates',
        },
      ]),
    )
    renderDashboard(<ProgressPage />, fetchMock, '/progress')
    expect(
      await screen.findByText(/No one has both a saved check-in/),
    ).toBeInTheDocument()
    cleanup()

    const soloFetch = vi.fn()
    dashboardResponses().forEach((item) =>
      soloFetch.mockResolvedValueOnce(item),
    )
    soloFetch.mockResolvedValueOnce(
      response([
        {
          active_participant_count: 1,
          challenge_id: 'challenge-1',
          current_week_end: '2026-09-20',
          current_week_start: '2026-09-14',
          eligible_participant_count: 1,
          leader_count: 0,
          leader_latest_dates: [],
          leader_names: [],
          previous_sunday: '2026-09-13',
          state: 'solo-challenge',
        },
      ]),
    )
    renderDashboard(<ProgressPage />, soloFetch, '/progress')
    await waitFor(() => expect(soloFetch.mock.calls.length).toBeGreaterThan(3))
    expect(
      screen.queryByRole('heading', { name: 'This week’s provisional leader' }),
    ).not.toBeInTheDocument()
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
    expect(screen.getByText('Weight-loss goal')).toBeInTheDocument()
  })

  it.each([
    {
      current: 90,
      directionLabel: 'Weight-loss goal',
      expected: 50,
      starting: 100,
      target: 80,
    },
    {
      current: 75,
      directionLabel: 'Weight-gain goal',
      expected: 50,
      starting: 70,
      target: 80,
    },
    {
      current: 80,
      directionLabel: 'Maintenance goal',
      expected: 100,
      starting: 80,
      target: 80,
    },
  ])(
    'renders bounded saved progress for $directionLabel',
    async ({ current, directionLabel, expected, starting, target }) => {
      const [challengeResponse, participantResponse] = dashboardResponses()
      const challenge = await challengeResponse.json()
      const participant = await participantResponse.json()
      participant[0].starting_weight_kg = starting
      participant[0].target_weight_kg = target
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response(challenge))
        .mockResolvedValueOnce(response(participant))
        .mockResolvedValueOnce(
          response([
            {
              created_at: '2026-09-18T10:00:00.000Z',
              id: 'weigh-in-latest',
              note: null,
              participant_id: 'participant-1',
              recorded_date: '2026-09-18',
              updated_at: '2026-09-18T10:00:00.000Z',
              weight_kg: current,
            },
          ]),
        )

      renderDashboard(<GoalsPage />, fetchMock)

      const progress = await screen.findByRole('progressbar', {
        name: `Milestone progress: ${expected}% complete`,
      })
      expect(progress).toHaveAttribute('aria-valuenow', `${expected}`)
      expect(screen.getByText(directionLabel)).toBeInTheDocument()
      expect(progress).not.toHaveAttribute('aria-valuenow', 'NaN')
    },
  )

  it('announces newly reached milestones based on saved weigh-ins', async () => {
    const viewerId = 'member-1'
    const key = [
      'slimpossible',
      'progress-celebrations',
      'v1',
      'milestones',
      encodeURIComponent(viewerId),
      encodeURIComponent('challenge-1'),
      encodeURIComponent('participant-1'),
    ].join(':')
    window.localStorage.setItem(key, JSON.stringify([]))
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    renderDashboard(<GoalsPage />, fetchMock)

    expect(
      await screen.findByText('Milestone reached: 25%, 50% of your goal.'),
    ).toBeInTheDocument()
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
      if (_ === 'Progress') fetchMock.mockResolvedValueOnce(response([]))
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

describe('GroupDashboardPage', () => {
  it('renders only aggregate progress and weekly winners returned by the RPC', async () => {
    const currentSunday = mostRecentSunday()
    const previousSundayDate = new Date(`${currentSunday}T00:00:00.000Z`)
    previousSundayDate.setUTCDate(previousSundayDate.getUTCDate() - 7)
    const previousSunday = previousSundayDate.toISOString().slice(0, 10)
    const challengePayload = [
      {
        created_at: '2026-09-17T10:00:00.000Z',
        created_by: 'owner-1',
        description: null,
        end_date: '2026-10-01',
        id: 'challenge-1',
        name: 'Autumn challenge',
        owner_id: 'owner-1',
        start_date: '2026-09-17',
        status: 'active',
        target_weight_kg: null,
        updated_at: '2026-09-17T10:00:00.000Z',
      },
    ]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(challengePayload))
      .mockResolvedValueOnce(
        response([
          {
            active_participant_count: 3,
            average_completion_percentage: 48.5,
            challenge_id: 'challenge-1',
            current_sunday: currentSunday,
            eligible_participant_count: 2,
            participants_with_progress_count: 2,
            participants_with_recorded_weight_count: 3,
            previous_sunday: previousSunday,
            reached_target_count: 1,
            weekly_winner_count: 2,
            weekly_winner_names: ['Ava', 'Ben'],
            private_note: 'do not render private notes',
            raw_weigh_ins: [{ weight_kg: 91.5 }],
          },
        ]),
      )
      .mockResolvedValueOnce(response(challengePayload))
      .mockResolvedValueOnce(
        response([
          {
            active_participant_count: 3,
            average_completion_percentage: 48.5,
            challenge_id: 'challenge-1',
            current_sunday: currentSunday,
            eligible_participant_count: 3,
            participants_with_progress_count: 2,
            participants_with_recorded_weight_count: 3,
            previous_sunday: previousSunday,
            reached_target_count: 1,
            weekly_winner_count: 1,
            weekly_winner_names: ['Casey'],
          },
        ]),
      )
      .mockResolvedValueOnce(response(challengePayload))
      .mockResolvedValueOnce(
        response([
          {
            active_participant_count: 3,
            average_completion_percentage: 48.5,
            challenge_id: 'challenge-1',
            current_sunday: currentSunday,
            eligible_participant_count: 3,
            participants_with_progress_count: 2,
            participants_with_recorded_weight_count: 3,
            previous_sunday: previousSunday,
            reached_target_count: 1,
            weekly_winner_count: 1,
            weekly_winner_names: ['Casey'],
          },
        ]),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(
      await screen.findByRole('heading', { name: 'Weekly winners' }),
    ).toBeInTheDocument()
    expect(screen.getByText('48.5%')).toBeInTheDocument()
    expect(screen.getByText(/Shared weekly winners/)).toBeInTheDocument()
    expect(
      screen.getByText(/based on 2 of 3 active members/),
    ).toBeInTheDocument()
    expect(screen.getByText('Ava')).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(
      screen.queryByText('do not render private notes'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('91.5')).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/weigh_ins')),
    ).toBe(false)

    const rpcRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/rpc/get_group_progress_summary'),
    )
    expect(JSON.parse(String(rpcRequest?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
      target_current_sunday: currentSunday,
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh shared progress' }),
    )
    expect(await screen.findByText('Casey')).toBeInTheDocument()
    expect(screen.queryByText('Ava')).not.toBeInTheDocument()
    expect(
      await screen.findByText('Weekly result updated: Casey.'),
    ).toHaveAttribute('role', 'status')

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh shared progress' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByText('Weekly result updated: Casey.'),
      ).not.toBeInTheDocument(),
    )
  })

  it('does not render group data when the membership-checked RPC denies access', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'owner-1',
            description: null,
            end_date: '2026-10-01',
            id: 'challenge-1',
            name: 'Autumn challenge',
            owner_id: 'owner-1',
            start_date: '2026-09-17',
            status: 'active',
            target_weight_kg: null,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
        ]),
      )
      .mockResolvedValueOnce(
        response(
          {
            code: '42501',
            details: 'internal row detail',
            hint: null,
            message: 'Group membership required.',
          },
          403,
        ),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(
      await screen.findByText(/available to active members only/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Weekly winners')).not.toBeInTheDocument()
    expect(screen.queryByText('internal row detail')).not.toBeInTheDocument()
  })
})

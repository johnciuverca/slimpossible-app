import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import {
  localDateOnly,
  provisionalWeekDates,
} from '../models/provisionalGroupLeader'

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

function dashboardResponses(
  challengeOwnerId = 'member-1',
  latestNote: string | null = null,
) {
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
        note: latestNote,
        participant_id: 'participant-1',
        recorded_date: '2026-09-18',
        updated_at: '2026-09-18T10:00:00.000Z',
        weight_kg: 90,
      },
    ]),
  ]
}

function groupProgressResponse(challengeId = 'challenge-1') {
  const currentSunday = mostRecentSunday()
  const previousSundayDate = new Date(`${currentSunday}T00:00:00.000Z`)
  previousSundayDate.setUTCDate(previousSundayDate.getUTCDate() - 7)
  return response([
    {
      active_participant_count: 3,
      average_completion_percentage: 40,
      challenge_id: challengeId,
      current_sunday: currentSunday,
      eligible_participant_count: 2,
      participants_with_progress_count: 3,
      participants_with_recorded_weight_count: 3,
      previous_sunday: previousSundayDate.toISOString().slice(0, 10),
      reached_target_count: 1,
      weekly_winner_count: 1,
      weekly_winner_names: ['Private sample winner'],
    },
  ])
}

function provisionalLeaderResponse({
  activeParticipantCount = 3,
  challengeId = 'challenge-1',
  eligibleParticipantCount = 2,
  leaderNames = ['Ava', 'Ben'],
  state = 'leaders',
}: {
  activeParticipantCount?: number
  challengeId?: string
  eligibleParticipantCount?: number
  leaderNames?: string[]
  state?: 'leaders' | 'no-eligible-candidates' | 'solo-challenge'
} = {}) {
  const week = provisionalWeekDates(localDateOnly())
  return response([
    {
      active_participant_count: activeParticipantCount,
      challenge_id: challengeId,
      current_week_end: week.currentWeekEnd,
      current_week_start: week.currentWeekStart,
      eligible_participant_count: eligibleParticipantCount,
      leader_count: leaderNames.length,
      leader_latest_dates: leaderNames.map(() => localDateOnly()),
      leader_names: leaderNames,
      previous_sunday: week.previousSunday,
      state,
      private_note: 'do not expose provisional notes',
      raw_history: [{ weight_kg: 91.5 }],
    },
  ])
}

function renderDashboard(
  page: React.ReactNode,
  fetchMock: ReturnType<typeof vi.fn>,
  initialEntry = '/today?challenge=challenge-1',
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
        user: { email: `${userId}@example.com`, id: userId },
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>{page}</MemoryRouter>
    </AuthProvider>,
  )
}

function authContextValue(userId: string): AuthContextValue {
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
      user: { email: `${userId}@example.com`, id: userId },
    },
  }
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
      screen.queryByRole('link', { name: 'Sign in to join a challenge' }),
    ).not.toBeInTheDocument()
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
    expect(
      screen.getByText((_, element) =>
        /^2\s*\/\s*3$/.test(element?.textContent?.trim() ?? ''),
      ),
    ).toBeInTheDocument()
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
    dashboardResponses(
      'owner-1',
      'A private note for this participant.',
    ).forEach((item) => fetchMock.mockResolvedValueOnce(item))
    fetchMock.mockResolvedValueOnce(groupProgressResponse())
    renderDashboard(<TodayPage />, fetchMock)

    expect(
      await screen.findByRole('heading', { name: 'Your latest weigh-in' }),
    ).toBeInTheDocument()
    expect(screen.getByText('90 kg')).toBeInTheDocument()
    expect(
      screen.getByText('A private note for this participant.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Private note · only you can see this'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('article', { name: 'This week’s check-ins' }),
      ).toHaveTextContent(/2\s*\/\s*3/),
    )
    expect(
      screen.getByText('You are 10 kg away from your target weight.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Record a weigh-in' }),
    ).toHaveAttribute('href', '/weigh-ins?challenge=challenge-1')
    expect(
      screen.getByRole('link', { name: 'See group progress' }),
    ).toHaveAttribute('href', '/group?challenge=challenge-1')
    expect(screen.queryByText('Private sample winner')).not.toBeInTheDocument()
    expect(screen.getByText(/Coming in Chapter 16/)).toBeInTheDocument()
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
      await screen.findByText('You have not enrolled in this challenge yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Enroll yourself' }),
    ).toHaveAttribute(
      'href',
      '/challenge/participants/enroll?challenge=challenge-1&self=owner',
    )
  })

  it('shows a keyboard-accessible setup action on Today when no challenge exists', async () => {
    const fetchMock = vi.fn().mockImplementation(() => response([]))
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

  it('defaults Today to the active joined challenge instead of an owned challenge', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/challenges?')) {
        return response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'member-1',
            description: null,
            end_date: '2026-10-01',
            id: 'owned-challenge',
            name: 'My unjoined challenge',
            owner_id: 'member-1',
            start_date: '2026-09-17',
            status: 'active',
            target_weight_kg: null,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
          {
            created_at: '2026-09-18T10:00:00.000Z',
            created_by: 'owner-2',
            description: null,
            end_date: '2026-10-01',
            id: 'joined-challenge',
            name: 'Challenge I joined',
            owner_id: 'owner-2',
            start_date: '2026-09-17',
            status: 'active',
            target_weight_kg: null,
            updated_at: '2026-09-18T10:00:00.000Z',
          },
        ])
      }
      if (url.includes('/participants?')) {
        return response([
          {
            challenge_id: 'joined-challenge',
            created_at: '2026-09-18T10:00:00.000Z',
            display_name: 'Current member',
            id: 'joined-participant',
            joined_at: '2026-09-18T10:00:00.000Z',
            starting_weight_kg: 100,
            status: 'active',
            target_weight_kg: 80,
            updated_at: '2026-09-18T10:00:00.000Z',
            user_id: 'member-1',
          },
        ])
      }
      if (url.includes('/weigh_ins?')) {
        return response([
          {
            created_at: '2026-09-18T10:00:00.000Z',
            id: 'joined-weigh-in',
            note: null,
            participant_id: 'joined-participant',
            recorded_date: '2026-09-18',
            updated_at: '2026-09-18T10:00:00.000Z',
            weight_kg: 89,
          },
        ])
      }
      return groupProgressResponse('joined-challenge')
    })
    renderDashboard(<TodayPage />, fetchMock, '/today')

    expect(
      await screen.findByText('Challenge I joined · Active'),
    ).toBeInTheDocument()
    expect(screen.getByText('89 kg')).toBeInTheDocument()
    expect(screen.queryByText('My unjoined challenge')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Enroll yourself' }),
    ).not.toBeInTheDocument()
  })

  it('does not offer an ownerless member a dead enrollment action', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo) => {
      if (String(input).includes('/challenges?')) {
        return response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'owner-2',
            description: null,
            end_date: '2026-10-01',
            id: 'challenge-1',
            name: 'Another owner’s challenge',
            owner_id: 'owner-2',
            start_date: '2026-09-17',
            status: 'active',
            target_weight_kg: null,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
        ])
      }
      return response([])
    })
    renderDashboard(<TodayPage />, fetchMock)

    expect(
      await screen.findByText(/Ask its owner for an invitation/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Enroll yourself' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Choose a joined challenge' }),
    ).toHaveAttribute('href', '/')
  })

  it('shows a distinct loading and error state on Today', async () => {
    let finishChallenges: (result: Response) => void = () => undefined
    const challengeResponse = new Promise<Response>((resolve) => {
      finishChallenges = resolve
    })
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo) =>
        String(input).includes('/challenges?')
          ? challengeResponse
          : response([]),
      )
    renderDashboard(<TodayPage />, fetchMock)
    expect(
      screen.getByText('Loading your saved dashboard…'),
    ).toBeInTheDocument()
    finishChallenges(response({ message: 'Challenge request failed' }, 500))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your challenges could not be loaded. Try refreshing.',
    )
    expect(
      screen.queryByRole('heading', { name: 'No challenge yet' }),
    ).not.toBeInTheDocument()
  })

  it('hides prior-account Today data while a newly selected account loads', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://home-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    let challengeRequestCount = 0
    let finishSecondChallenge: (result: Response) => void = () => undefined
    const secondChallengeResponse = new Promise<Response>((resolve) => {
      finishSecondChallenge = resolve
    })
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = String(input)
      if (url.includes('/challenges?')) {
        challengeRequestCount += 1
        return challengeRequestCount === 1
          ? response([
              {
                created_at: '2026-09-17T10:00:00.000Z',
                created_by: 'member-1',
                description: null,
                end_date: '2026-10-01',
                id: 'account-one-challenge',
                name: 'Account one challenge',
                owner_id: 'member-1',
                start_date: '2026-09-17',
                status: 'active',
                target_weight_kg: null,
                updated_at: '2026-09-17T10:00:00.000Z',
              },
            ])
          : secondChallengeResponse
      }
      if (url.includes('/participants?')) {
        const secondAccount = challengeRequestCount > 1
        return response([
          {
            challenge_id: secondAccount
              ? 'account-two-challenge'
              : 'account-one-challenge',
            created_at: '2026-09-17T10:00:00.000Z',
            display_name: 'Current participant',
            id: secondAccount ? 'participant-two' : 'participant-one',
            joined_at: '2026-09-17T10:00:00.000Z',
            starting_weight_kg: 100,
            status: 'active',
            target_weight_kg: 80,
            updated_at: '2026-09-17T10:00:00.000Z',
            user_id: secondAccount ? 'member-2' : 'member-1',
          },
        ])
      }
      if (url.includes('/weigh_ins?')) {
        const secondAccount = challengeRequestCount > 1
        return response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            id: secondAccount ? 'weigh-in-two' : 'weigh-in-one',
            note: secondAccount
              ? 'Account two private note'
              : 'Account one private note',
            participant_id: secondAccount
              ? 'participant-two'
              : 'participant-one',
            recorded_date: '2026-09-17',
            updated_at: '2026-09-17T10:00:00.000Z',
            weight_kg: secondAccount ? 70 : 90,
          },
        ])
      }
      return groupProgressResponse(
        challengeRequestCount > 1
          ? 'account-two-challenge'
          : 'account-one-challenge',
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(
      <AuthContext.Provider value={authContextValue('member-1')}>
        <MemoryRouter initialEntries={['/today']}>
          <TodayPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(
      await screen.findByText('Account one private note'),
    ).toBeInTheDocument()
    rerender(
      <AuthContext.Provider value={authContextValue('member-2')}>
        <MemoryRouter initialEntries={['/today']}>
          <TodayPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(
      screen.queryByText('Account one private note'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Loading your saved dashboard…'),
    ).toBeInTheDocument()

    finishSecondChallenge(
      response([
        {
          created_at: '2026-09-18T10:00:00.000Z',
          created_by: 'owner-2',
          description: null,
          end_date: '2026-10-01',
          id: 'account-two-challenge',
          name: 'Account two challenge',
          owner_id: 'owner-2',
          start_date: '2026-09-17',
          status: 'active',
          target_weight_kg: null,
          updated_at: '2026-09-18T10:00:00.000Z',
        },
      ]),
    )
    expect(
      await screen.findByText('Account two private note'),
    ).toBeInTheDocument()
    expect(screen.getByText('70 kg')).toBeInTheDocument()
    expect(screen.queryByText('Account one challenge')).not.toBeInTheDocument()
  })

  it('renders saved history and trend on Progress', async () => {
    const fetchMock = vi.fn()
    dashboardResponses().forEach((item) =>
      fetchMock.mockResolvedValueOnce(item),
    )
    fetchMock.mockResolvedValueOnce(response([]))
    renderDashboard(<ProgressPage />, fetchMock)

    const historyTable = await screen.findByRole('table', {
      name: 'Your saved personal weigh-ins',
    })
    const historyRows = within(historyTable).getAllByRole('row')
    expect(historyRows[1]).toHaveTextContent('90 kg')
    expect(historyRows[1]).toHaveTextContent('−5 kg')
    expect(historyRows[2]).toHaveTextContent('95 kg')
    expect(
      screen.getByText(/Change from first to latest saved check-in: −5 kg/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /2 saved weigh-ins/ }),
    ).toHaveAttribute(
      'aria-label',
      expect.stringContaining(
        '2026-09-17, 95 kilograms to 2026-09-18, 90 kilograms',
      ),
    )
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

  it('keeps Goals loading and error feedback distinct', async () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined))
    renderDashboard(<GoalsPage />, pendingFetch, '/goals?challenge=challenge-1')
    expect(
      screen.getByText('Loading your saved dashboard…'),
    ).toBeInTheDocument()
    cleanup()

    const failedFetch = vi
      .fn()
      .mockImplementation((input: RequestInfo) =>
        String(input).includes('/challenges?')
          ? response({ message: 'Request failed' }, 500)
          : response([]),
      )
    renderDashboard(<GoalsPage />, failedFetch, '/goals?challenge=challenge-1')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your challenges could not be loaded. Try refreshing.',
    )
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
      starting: 80,
      target: 80,
      maintenance: true,
    },
  ])(
    'renders bounded saved progress for $directionLabel',
    async ({
      current,
      directionLabel,
      expected,
      starting,
      target,
      maintenance,
    }) => {
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

      if (maintenance) {
        expect(
          await screen.findByText(/Normal check-in fluctuations are shown/),
        ).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      } else {
        const progress = await screen.findByRole('progressbar', {
          name: `Milestone progress: ${expected}% complete`,
        })
        expect(progress).toHaveAttribute('aria-valuenow', `${expected}`)
        expect(progress).not.toHaveAttribute('aria-valuenow', 'NaN')
      }
      expect(screen.getByText(directionLabel)).toBeInTheDocument()
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
        expect(
          screen.getByText(
            _ === 'Today' ? /Autumn challenge · Active/ : 'Autumn challenge',
          ),
        ).toBeInTheDocument(),
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
      .mockResolvedValueOnce(provisionalLeaderResponse())
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
      .mockResolvedValueOnce(
        provisionalLeaderResponse({
          eligibleParticipantCount: 0,
          leaderNames: [],
          state: 'no-eligible-candidates',
        }),
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
      .mockResolvedValueOnce(
        provisionalLeaderResponse({
          eligibleParticipantCount: 0,
          leaderNames: [],
          state: 'no-eligible-candidates',
        }),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(
      await screen.findByRole('heading', { name: 'Weekly result' }),
    ).toBeInTheDocument()
    expect(screen.getByText('48.5%')).toBeInTheDocument()
    expect(screen.getByText(/Shared weekly winners/)).toBeInTheDocument()
    expect(
      screen.getByText(/based on 2 of 3 active members/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Ava')).toHaveLength(2)
    expect(screen.getAllByText('Ben')).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: 'Provisional leader' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Shared provisional leaders')).toBeInTheDocument()
    const provisionalLeaderRegion = screen.getByRole('region', {
      name: 'Provisional leader',
    })
    expect(provisionalLeaderRegion).toHaveTextContent('Ties are shared')
    const unavailableHistory = screen.getByRole('region', {
      name: 'Group chart and weigh-in history',
    })
    expect(unavailableHistory).toHaveAttribute('aria-disabled', 'true')
    expect(unavailableHistory).toHaveTextContent(
      'Not available yet · Chapter 16',
    )
    expect(
      within(unavailableHistory).queryByRole('img'),
    ).not.toBeInTheDocument()
    expect(
      within(unavailableHistory).queryByRole('table'),
    ).not.toBeInTheDocument()
    expect(
      within(unavailableHistory).queryByRole('button'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('do not render private notes'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('do not expose provisional notes'),
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
    const provisionalRequest = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/rpc/get_provisional_group_leader_summary'),
    )
    expect(JSON.parse(String(provisionalRequest?.[1]?.body))).toEqual({
      target_challenge_id: 'challenge-1',
      target_current_date: localDateOnly(),
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh shared progress' }),
    )
    expect(await screen.findByText('Casey')).toBeInTheDocument()
    expect(screen.queryByText('Ava')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Provisional leader' }),
      ).toHaveTextContent('No provisional leader is available yet'),
    )
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

  it('denies an owner who does not have active membership', async () => {
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
      'owner-1',
    )

    expect(
      await screen.findByText(/available to active members only/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Weekly winners')).not.toBeInTheDocument()
    expect(screen.queryByText('internal row detail')).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/rpc/get_provisional_group_leader_summary'),
      ),
    ).toBe(false)
  })

  it('allows an owner who is an active challenge member', async () => {
    const currentSunday = mostRecentSunday()
    const previousSundayDate = new Date(`${currentSunday}T00:00:00.000Z`)
    previousSundayDate.setUTCDate(previousSundayDate.getUTCDate() - 7)
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
        response([
          {
            active_participant_count: 2,
            average_completion_percentage: 35,
            challenge_id: 'challenge-1',
            current_sunday: currentSunday,
            eligible_participant_count: 1,
            participants_with_progress_count: 1,
            participants_with_recorded_weight_count: 1,
            previous_sunday: previousSundayDate.toISOString().slice(0, 10),
            reached_target_count: 0,
            weekly_winner_count: 1,
            weekly_winner_names: ['Owner'],
          },
        ]),
      )
      .mockResolvedValueOnce(
        provisionalLeaderResponse({
          activeParticipantCount: 2,
          eligibleParticipantCount: 1,
          leaderNames: ['Owner'],
        }),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
      'owner-1',
    )

    expect(await screen.findByText('35%')).toBeInTheDocument()
    expect(screen.getAllByText('Owner')).toHaveLength(2)
    expect(
      screen.queryByText(/available to active members only/),
    ).not.toBeInTheDocument()
  })

  it('keeps authorized summary visible when the provisional RPC fails', async () => {
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
      .mockResolvedValueOnce(groupProgressResponse())
      .mockResolvedValueOnce(
        response({ message: 'Internal server error' }, 500),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(await screen.findByText('40%')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Provisional group progress is unavailable right now.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
  })

  it('does not render outsider data after membership RPC denial', async () => {
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
        response({ message: 'Group membership required.' }, 403),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
      'outsider-1',
    )

    expect(
      await screen.findByText(/available to active members only/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Weekly result' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Ava')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps outsider data unavailable when no challenge is visible', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response([]))
    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
      'outsider-1',
    )

    expect(
      await screen.findByText('No challenge is available for this account.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Group progress' }),
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('switches and refreshes only the selected challenge summary', async () => {
    const challenges = [
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
      {
        created_at: '2026-09-17T10:00:00.000Z',
        created_by: 'member-1',
        description: null,
        end_date: '2026-12-01',
        id: 'challenge-2',
        name: 'Winter challenge',
        owner_id: 'member-1',
        start_date: '2026-10-01',
        status: 'active',
        target_weight_kg: null,
        updated_at: '2026-09-17T10:00:00.000Z',
      },
    ]
    const currentSunday = mostRecentSunday()
    const previousSundayDate = new Date(`${currentSunday}T00:00:00.000Z`)
    previousSundayDate.setUTCDate(previousSundayDate.getUTCDate() - 7)
    const previousSunday = previousSundayDate.toISOString().slice(0, 10)
    const groupResponses = [
      {
        activeCount: 3,
        average: 45.1,
        challengeId: 'challenge-1',
      },
      {
        activeCount: 5,
        average: 61.2,
        challengeId: 'challenge-2',
      },
      {
        activeCount: 6,
        average: 64.3,
        challengeId: 'challenge-2',
      },
    ]
    const leaderResponses = [
      { challengeId: 'challenge-1', leaderNames: ['Ava'] },
      { challengeId: 'challenge-2', leaderNames: ['Jamie'] },
      { challengeId: 'challenge-2', leaderNames: ['Jo'] },
    ]
    const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
      const url = String(args[0])
      if (url.includes('/challenges?')) return response(challenges)
      if (url.includes('/rpc/get_group_progress_summary')) {
        const result = groupResponses.shift()!
        return response([
          {
            active_participant_count: result.activeCount,
            average_completion_percentage: result.average,
            challenge_id: result.challengeId,
            current_sunday: currentSunday,
            eligible_participant_count: 0,
            participants_with_progress_count: result.activeCount,
            participants_with_recorded_weight_count: result.activeCount,
            previous_sunday: previousSunday,
            reached_target_count: 0,
            weekly_winner_count: 0,
            weekly_winner_names: [],
          },
        ])
      }
      if (url.includes('/rpc/get_provisional_group_leader_summary')) {
        const result = leaderResponses.shift()!
        return provisionalLeaderResponse({
          activeParticipantCount: 3,
          challengeId: result.challengeId,
          eligibleParticipantCount: result.leaderNames.length,
          leaderNames: result.leaderNames,
        })
      }
      return response([])
    })

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(await screen.findByText('45.1%')).toBeInTheDocument()
    const challengeSelector = screen.getByRole('combobox', {
      name: 'Selected challenge',
    })
    fireEvent.change(challengeSelector, { target: { value: 'challenge-2' } })
    expect(await screen.findByText('61.2%')).toBeInTheDocument()
    expect(challengeSelector).toHaveValue('challenge-2')
    expect(screen.queryByText('45.1%')).not.toBeInTheDocument()
    expect(await screen.findByText('Jamie')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh shared progress' }),
    )
    expect(await screen.findByText('64.3%')).toBeInTheDocument()
    expect(screen.queryByText('61.2%')).not.toBeInTheDocument()
    expect(await screen.findByText('Jo')).toBeInTheDocument()

    const groupRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/rpc/get_group_progress_summary'),
    )
    expect(
      groupRequests.map(
        ([, requestInit]) =>
          JSON.parse(String(requestInit?.body)).target_challenge_id,
      ),
    ).toEqual(['challenge-1', 'challenge-2', 'challenge-2'])
  })

  it('shows real zero-data states without inventing group values', async () => {
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
    const currentSunday = mostRecentSunday()
    const previousSundayDate = new Date(`${currentSunday}T00:00:00.000Z`)
    previousSundayDate.setUTCDate(previousSundayDate.getUTCDate() - 7)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(challengePayload))
      .mockResolvedValueOnce(
        response([
          {
            active_participant_count: 0,
            average_completion_percentage: null,
            challenge_id: 'challenge-1',
            current_sunday: currentSunday,
            eligible_participant_count: 0,
            participants_with_progress_count: 0,
            participants_with_recorded_weight_count: 0,
            previous_sunday: previousSundayDate.toISOString().slice(0, 10),
            reached_target_count: 0,
            weekly_winner_count: 0,
            weekly_winner_names: [],
          },
        ]),
      )
      .mockResolvedValueOnce(
        provisionalLeaderResponse({
          activeParticipantCount: 0,
          eligibleParticipantCount: 0,
          leaderNames: [],
          state: 'solo-challenge',
        }),
      )

    renderDashboard(
      <GroupDashboardPage />,
      fetchMock,
      '/group?challenge=challenge-1',
    )

    expect(
      await screen.findByText(
        'No weekly result is available until participants record both Sunday weigh-ins.',
      ),
    ).toBeInTheDocument()
    const activeMembers = screen.getByText('Active members').parentElement
    expect(activeMembers).toHaveTextContent('0')
    const averageProgress = screen.getByText(
      'Average goal progress',
    ).parentElement
    expect(averageProgress).toHaveTextContent('—')
    expect(
      screen.getByText(
        'No active members are available for a provisional result.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument()
  })

  it('keeps Group loading and error feedback distinct', async () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => undefined))
    renderDashboard(
      <GroupDashboardPage />,
      pendingFetch,
      '/group?challenge=challenge-1',
    )
    expect(
      screen.getByText('Loading your saved dashboard…'),
    ).toBeInTheDocument()
    cleanup()

    const failedFetch = vi
      .fn()
      .mockImplementation((input: RequestInfo) =>
        String(input).includes('/challenges?')
          ? response({ message: 'Request failed' }, 500)
          : response([]),
      )
    renderDashboard(
      <GroupDashboardPage />,
      failedFetch,
      '/group?challenge=challenge-1',
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load the selected group challenge.',
    )
  })
})

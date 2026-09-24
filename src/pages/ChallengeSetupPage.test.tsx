import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '../auth/AuthContext'
import type { AuthGateway } from '../auth/context'
import { ParticipantEnrollmentPage } from './ParticipantEnrollmentPage'
import { ChallengeSetupPage } from './ChallengeSetupPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ChallengeSetupPage', () => {
  function renderPage() {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )
  }

  it('preserves all entered fields while a saved challenge finishes loading', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider
        initialState={{
          error: null,
          status: 'signed-in',
          user: { email: 'owner@example.com', id: 'owner-1' },
        }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Typed while loading' },
    })
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'Keep this description.' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    resolveFetch(
      new Response(
        JSON.stringify([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'owner-1',
            description: 'Previously saved description',
            end_date: '2026-12-01',
            id: 'challenge-1',
            name: 'Previously saved challenge',
            owner_id: 'owner-1',
            start_date: '2026-09-01',
            status: 'draft',
            target_weight_kg: 85,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
        ]),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    )

    await waitFor(() => {
      expect(
        screen.queryByText('Loading saved challenge…'),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByRole('textbox', { name: 'Challenge name' })).toHaveValue(
      'Typed while loading',
    )
    expect(screen.getByLabelText('Description (optional)')).toHaveValue(
      'Keep this description.',
    )
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-11-01')
    expect(
      screen.queryByLabelText('Target weight in kg (optional)'),
    ).not.toBeInTheDocument()
  })

  it('restores an untouched saved challenge after refresh', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          createdAt: '2026-09-17T10:00:00.000Z',
          createdBy: 'local-owner',
          description: 'Saved locally',
          endDate: '2026-12-01',
          id: 'challenge-1',
          name: 'Restored challenge',
          ownerId: 'local-owner',
          startDate: '2026-09-01',
          status: 'draft',
          targetWeightKg: 85,
          updatedAt: '2026-09-17T10:00:00.000Z',
        },
      ]),
    )
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Restored challenge' }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Saved challenge'), {
      target: { value: 'challenge-1' },
    })
    expect(screen.getByRole('textbox', { name: 'Challenge name' })).toHaveValue(
      'Restored challenge',
    )
    expect(screen.getByLabelText('Description (optional)')).toHaveValue(
      'Saved locally',
    )
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-09-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-12-01')
    expect(
      screen.queryByLabelText('Target weight in kg (optional)'),
    ).not.toBeInTheDocument()
  })

  it('preserves typed fields when session restoration reloads multiple challenges', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'owner-1',
            description: 'First saved challenge',
            end_date: '2026-12-01',
            id: 'challenge-1',
            name: 'First challenge',
            owner_id: 'owner-1',
            start_date: '2026-09-01',
            status: 'draft',
            target_weight_kg: 85,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
          {
            created_at: '2026-09-18T10:00:00.000Z',
            created_by: 'owner-1',
            description: 'Second saved challenge',
            end_date: '2027-01-01',
            id: 'challenge-2',
            name: 'Second challenge',
            owner_id: 'owner-1',
            start_date: '2026-10-01',
            status: 'draft',
            target_weight_kg: 80,
            updated_at: '2026-09-18T10:00:00.000Z',
          },
        ]),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    let resolveSession!: (user: { email: string; id: string }) => void
    const gateway: AuthGateway = {
      ensureProfile: async () => undefined,
      getSession: () =>
        new Promise((resolve) => {
          resolveSession = resolve
        }),
      onAuthStateChange: () => () => undefined,
      requestPasswordRecovery: async () => undefined,
      resetPassword: async () => undefined,
      signIn: async () => ({ email: 'owner@example.com', id: 'owner-1' }),
      signOut: async () => undefined,
      signUp: async () => ({ needsVerification: false, user: null }),
    }

    render(
      <AuthProvider authGateway={gateway}>
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await waitFor(() => expect(resolveSession).toBeTypeOf('function'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Typed during restore' },
    })
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'Do not replace this text.' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-12-01' },
    })
    await act(async () => {
      resolveSession({ email: 'owner@example.com', id: 'owner-1' })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'First challenge' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Second challenge' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByRole('textbox', { name: 'Challenge name' })).toHaveValue(
      'Typed during restore',
    )
    expect(screen.getByLabelText('Description (optional)')).toHaveValue(
      'Do not replace this text.',
    )
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-12-01')
    expect(
      screen.queryByLabelText('Target weight in kg (optional)'),
    ).not.toBeInTheDocument()
  })

  it('reports required and date-order errors accessibly', () => {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )

    fireEvent.submit(screen.getByRole('form', { name: 'Challenge setup form' }))

    expect(
      screen.getByRole('textbox', { name: 'Challenge name' }),
    ).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Enter a challenge name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a start date.')).toBeInTheDocument()
    expect(screen.getByText('Choose an end date.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-10' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Challenge setup form' }))

    expect(
      screen.getByText('End date must be on or after the start date.'),
    ).toBeInTheDocument()
  })

  it('accepts valid challenge details and keeps the preview local', async () => {
    render(
      <MemoryRouter>
        <ChallengeSetupPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'A steady challenge for the team.' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })
    const savedChallenges = JSON.parse(
      window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
    ) as Array<Record<string, unknown>>
    expect(savedChallenges[0]).not.toHaveProperty('targetWeightKg')
    expect(
      screen.queryByLabelText('Target weight in kg (optional)'),
    ).not.toBeInTheDocument()
  })

  it('offers self-enrollment for the newly saved challenge and keeps it on back navigation', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          createdAt: '2026-09-17T10:00:00.000Z',
          createdBy: 'local-owner',
          endDate: '2026-12-01',
          id: 'older-challenge',
          name: 'Older challenge',
          ownerId: 'local-owner',
          startDate: '2026-09-01',
          status: 'draft',
          updatedAt: '2026-09-17T10:00:00.000Z',
        },
      ]),
    )
    render(
      <MemoryRouter initialEntries={['/challenge/setup']}>
        <Routes>
          <Route element={<ChallengeSetupPage />} path="/challenge/setup" />
          <Route
            element={<ParticipantEnrollmentPage />}
            path="/challenge/participants/enroll"
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Older challenge' }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'New challenge' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    expect(
      screen.queryByText('Will you participate too?'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(
      await screen.findByText('Will you participate too?'),
    ).toBeInTheDocument()
    const savedChallenges = JSON.parse(
      window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
    ) as Array<Record<string, unknown>>
    const newChallenge = savedChallenges.find(
      ({ name }) => name === 'New challenge',
    )
    expect(newChallenge).toBeDefined()
    const challengeId = String(newChallenge?.id)
    const yesLink = screen.getByRole('link', {
      name: 'Yes, I’ll participate',
    })
    expect(yesLink).toHaveAttribute(
      'href',
      `/challenge/participants/enroll?challenge=${challengeId}&self=owner`,
    )
    fireEvent.click(yesLink)

    expect(
      await screen.findByRole('form', { name: 'Participant enrollment form' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toBeInTheDocument()
    expect(screen.getByLabelText('Starting weight in kg')).toBeInTheDocument()
    expect(screen.getByLabelText('Target weight in kg')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Participant identifier'),
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Local owner' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '92' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    expect(
      await screen.findByText(
        'Local owner was enrolled in the local challenge.',
      ),
    ).toBeInTheDocument()
    const participants = JSON.parse(
      window.localStorage.getItem('slimpossible.local.participants') ?? '[]',
    ) as Array<Record<string, unknown>>
    expect(participants).toHaveLength(1)
    expect(participants[0]).toMatchObject({
      challengeId,
      startingWeightKg: 92,
      targetWeightKg: 80,
      userId: 'local-owner',
    })

    fireEvent.click(
      screen.getByRole('link', { name: 'Back to challenge setup' }),
    )
    expect(
      await screen.findByRole('option', { name: 'New challenge' }),
    ).toBeInTheDocument()
    expect(
      JSON.parse(
        window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
      ),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: challengeId })]),
    )
  })

  it('lets the owner choose organizer-only and offers challenge-specific next steps', async () => {
    renderPage()
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Organizer challenge' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(
      await screen.findByText('Will you participate too?'),
    ).toBeInTheDocument()
    const [savedChallenge] = JSON.parse(
      window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
    ) as Array<Record<string, unknown>>
    const challengeId = String(savedChallenge.id)
    fireEvent.click(
      screen.getByRole('button', { name: 'No, I’ll organize only' }),
    )

    expect(screen.getByText(/You’re the organizer only/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Invite participants' }),
    ).toHaveAttribute('href', `/challenge/invites?challenge=${challengeId}`)
    expect(
      screen.getByRole('link', { name: 'Join later from Today' }),
    ).toHaveAttribute('href', `/today?challenge=${challengeId}`)
    expect(window.localStorage.getItem('slimpossible.local.participants')).toBe(
      null,
    )

    fireEvent.change(screen.getByLabelText('Saved challenge'), {
      target: { value: challengeId },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Organizer challenge updated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update challenge' }))
    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByText('Will you participate too?'),
    ).not.toBeInTheDocument()
  })

  it('preserves a legacy challenge target when editing a saved challenge', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          createdAt: '2026-09-17T10:00:00.000Z',
          createdBy: 'local-owner',
          endDate: '2026-12-01',
          id: 'legacy-challenge',
          name: 'Legacy challenge',
          ownerId: 'local-owner',
          startDate: '2026-09-01',
          status: 'draft',
          targetWeightKg: 85,
          updatedAt: '2026-09-17T10:00:00.000Z',
        },
      ]),
    )
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Legacy challenge' }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Saved challenge'), {
      target: { value: 'legacy-challenge' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Updated legacy challenge' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update challenge' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })
    const [savedChallenge] = JSON.parse(
      window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
    ) as Array<Record<string, unknown>>
    expect(savedChallenge).toMatchObject({
      id: 'legacy-challenge',
      name: 'Updated legacy challenge',
      targetWeightKg: 85,
    })
  })

  it('settles a failed remote load with a clear error', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://failed-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider
        initialState={{
          error: null,
          status: 'signed-in',
          user: { email: 'owner@example.com', id: 'owner-1' },
        }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to load the challenges.',
      )
    })
    expect(
      screen.queryByText('Loading saved challenge…'),
    ).not.toBeInTheDocument()
  })

  it('settles a stalled remote load after the timeout', async () => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://slow-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider
        initialState={{
          error: null,
          status: 'signed-in',
          user: { email: 'owner@example.com', id: 'owner-1' },
        }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Save challenge' }),
    ).not.toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved challenges took too long to load.',
    )
    expect(
      screen.queryByText('Loading saved challenge…'),
    ).not.toBeInTheDocument()

    cleanup()
    render(
      <AuthProvider
        initialState={{
          error: null,
          status: 'signed-in',
          user: { email: 'owner@example.com', id: 'owner-1' },
        }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved challenges took too long to load.',
    )
  })

  it('does not query remote challenges again for the same auth notification', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://stable-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const user = { email: 'owner@example.com', id: 'owner-1' }
    let emitAuthStateChange:
      ((nextUser: typeof user | null) => void) | undefined
    const gateway: AuthGateway = {
      ensureProfile: async () => undefined,
      getSession: async () => user,
      onAuthStateChange: (callback) => {
        emitAuthStateChange = callback
        return () => undefined
      },
      requestPasswordRecovery: async () => undefined,
      resetPassword: async () => undefined,
      signIn: async () => user,
      signOut: async () => undefined,
      signUp: async () => ({ needsVerification: false, user: null }),
    }

    render(
      <AuthProvider authGateway={gateway}>
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      emitAuthStateChange?.(user)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows signed-out remote persistence as an actionable state', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://signed-out-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')

    render(
      <AuthProvider
        initialState={{ error: null, status: 'signed-out', user: null }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Remote persistence is unavailable until a Supabase session is signed in.',
    )
    expect(
      screen.queryByText('Loading saved challenge…'),
    ).not.toBeInTheDocument()
  })

  it('restores multiple local challenges and edits only the selected one', async () => {
    renderPage()

    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Autumn reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-11-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByText(/Nothing has been saved remotely\./),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New challenge' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Challenge name' }), {
      target: { value: 'Winter reset' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2027-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Autumn reset' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Winter reset' }),
      ).toBeInTheDocument()
    })

    cleanup()
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Autumn reset' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', { name: 'Winter reset' }),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Saved challenge'), {
      target: {
        value: screen
          .getByRole('option', { name: 'Autumn reset' })
          .getAttribute('value'),
      },
    })
    expect(screen.getByRole('textbox', { name: 'Challenge name' })).toHaveValue(
      'Autumn reset',
    )
  })

  it('keeps the enrollment link sized to its visible control and keyboard-focusable', () => {
    renderPage()

    const enrollmentLink = screen.getByRole('link', {
      name: 'Enroll participants',
    })
    expect(enrollmentLink).toHaveClass('inline-block')
    expect(enrollmentLink).not.toHaveClass('block')
    expect(enrollmentLink).toHaveClass('focus-visible:outline-emerald-700')

    enrollmentLink.focus()
    expect(enrollmentLink).toHaveFocus()

    const homeLink = screen.getByRole('link', { name: 'Back to home' })
    const actionGroup = screen.getByRole('navigation', {
      name: 'Challenge actions',
    })
    expect(homeLink).toHaveAttribute('href', '/')
    expect(homeLink).toHaveClass('inline-block')
    expect(enrollmentLink).toHaveClass('inline-block')
    expect(actionGroup).toHaveClass('flex', 'flex-col', 'gap-4')
  })
})

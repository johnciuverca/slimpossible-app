import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from '../auth/context'
import { ParticipantEnrollmentPage } from './ParticipantEnrollmentPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function renderPage(authValue?: AuthContextValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/challenge/participants/enroll']}>
        <ParticipantEnrollmentPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function makeAuthValue(state: AuthState): AuthContextValue {
  return {
    requestPasswordRecovery: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => true),
    retrySession: vi.fn(),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    signUp: vi.fn(async () => undefined),
    state,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

describe('ParticipantEnrollmentPage', () => {
  it('reports required fields and validation feedback accessibly', () => {
    renderPage()

    fireEvent.submit(
      screen.getByRole('form', { name: 'Participant enrollment form' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields before enrolling.',
    )
    expect(screen.getByText('Display name is required.')).toBeInTheDocument()
    expect(screen.getByText('User id is required.')).toBeInTheDocument()
    expect(
      screen.getByText('Starting weight must be a positive finite number.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Target weight must be a positive finite number.'),
    ).toBeInTheDocument()
  })

  it('accepts a positive target above the starting weight for a gain goal', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Alex Participant' },
    })
    fireEvent.change(screen.getByLabelText('Participant identifier'), {
      target: { value: 'alex-1' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '90' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Alex Participant was enrolled in the local challenge.',
        ),
      ).toBeInTheDocument()
    })
  })

  it('enrolls a valid participant into local persisted state', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Alex Participant' },
    })
    fireEvent.change(screen.getByLabelText('Participant identifier'), {
      target: { value: 'alex-1' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '92.5' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Alex Participant was enrolled in the local challenge.',
        ),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Alex Participant')).toBeInTheDocument()
    expect(screen.getByText('92.5 kg → 80 kg')).toBeInTheDocument()
    expect(
      screen.queryByText('No participants enrolled yet.'),
    ).not.toBeInTheDocument()
  })

  it('clears the transient restore error and enrolls the owner by auth identity', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://staging-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')

    const ownerId = '11111111-1111-4111-8111-111111111111'
    const existingMember = {
      challenge_id: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-09-24T09:00:00.000Z',
      display_name: 'Existing member',
      id: '33333333-3333-4333-8333-333333333333',
      joined_at: '2026-09-24T09:00:00.000Z',
      status: 'active',
      starting_weight_kg: 88,
      target_weight_kg: 80,
      user_id: '44444444-4444-4444-8444-444444444444',
    }
    const createdOwnerMembership = {
      ...existingMember,
      display_name: 'Challenge owner',
      id: '55555555-5555-4555-8555-555555555555',
      starting_weight_kg: 90,
      target_weight_kg: 82,
      user_id: ownerId,
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'

        if (url.includes('/challenges?')) {
          return jsonResponse([
            {
              created_at: '2026-09-24T08:00:00.000Z',
              created_by: ownerId,
              description: null,
              end_date: '2026-12-01',
              id: existingMember.challenge_id,
              name: 'Owner challenge',
              owner_id: ownerId,
              start_date: '2026-09-01',
              status: 'active',
              target_weight_kg: null,
              updated_at: '2026-09-24T08:00:00.000Z',
            },
          ])
        }
        if (url.includes('/participants?') && method === 'GET') {
          return jsonResponse([existingMember])
        }
        if (url.includes('/participants') && method === 'POST') {
          return jsonResponse(createdOwnerMembership, 201)
        }
        throw new Error(`Unexpected staging request: ${method} ${url}`)
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const view = renderPage(
      makeAuthValue({ error: null, status: 'loading', user: null }),
    )

    expect(screen.getByText('Restoring your session…')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    view.rerender(
      <AuthContext.Provider
        value={makeAuthValue({
          error: null,
          status: 'signed-in',
          user: { email: 'owner@example.test', id: ownerId },
        })}
      >
        <MemoryRouter initialEntries={['/challenge/participants/enroll']}>
          <ParticipantEnrollmentPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(await screen.findByText('Existing member')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Participant identifier'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'This membership will be linked to your signed-in account.',
      ),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Challenge owner' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '90' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '82' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enroll participant' }))

    await waitFor(() =>
      expect(
        screen.getByText('Challenge owner was enrolled remotely.'),
      ).toBeInTheDocument(),
    )

    const createCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      challenge_id: existingMember.challenge_id,
      user_id: ownerId,
    })
    expect(screen.getByText('Existing member')).toBeInTheDocument()
    expect(screen.getByText('90 kg → 82 kg')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false)
  })

  it('keeps an actual session restoration failure visible and disables remote writes', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://staging-project.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')

    renderPage(
      makeAuthValue({
        error: 'We could not restore your session. Try again.',
        status: 'error',
        user: null,
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We could not restore your session. Try again.',
    )
    expect(
      screen.getByRole('button', { name: 'Enroll participant' }),
    ).toBeDisabled()
  })
})

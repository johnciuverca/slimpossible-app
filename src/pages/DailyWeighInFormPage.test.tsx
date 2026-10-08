import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useNavigate } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../auth/context'
import { DailyWeighInFormPage } from './DailyWeighInFormPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function renderPage() {
  render(
    <MemoryRouter>
      <DailyWeighInFormPage />
    </MemoryRouter>,
  )
  await screen.findByRole('form', { name: 'Daily weigh-in form' })
}

function dateOffset(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

function challengeRow(id: string, name: string) {
  return {
    created_at: '2026-09-17T10:00:00.000Z',
    created_by: 'owner-1',
    description: null,
    end_date: '2026-10-17',
    id,
    name,
    owner_id: 'owner-1',
    start_date: '2026-09-17',
    status: 'active',
    target_weight_kg: 80,
    updated_at: '2026-09-17T10:00:00.000Z',
  }
}

function participantRow(
  userId: string,
  id: string,
  challengeId: string,
  displayName: string,
) {
  return {
    challenge_id: challengeId,
    created_at: '2026-09-17T10:00:00.000Z',
    display_name: displayName,
    id,
    joined_at: '2026-09-17T10:00:00.000Z',
    starting_weight_kg: 90,
    status: 'active',
    target_weight_kg: 80,
    updated_at: '2026-09-17T10:00:00.000Z',
    user_id: userId,
  }
}

function authValue(userId: string): AuthContextValue {
  return {
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => false,
    retrySession: () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
    state: {
      error: null,
      status: 'signed-in',
      user: { email: `${userId}@example.com`, id: userId },
    },
  }
}

function ChallengeSwitchControl() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/weigh-ins?challenge=challenge-two')}
      type="button"
    >
      Switch selected challenge
    </button>
  )
}

function remotePage(
  initialEntries: string[],
  userId = 'member-1',
  withChallengeSwitch = false,
) {
  return (
    <AuthContext.Provider value={authValue(userId)}>
      <MemoryRouter initialEntries={initialEntries}>
        {withChallengeSwitch ? <ChallengeSwitchControl /> : null}
        <DailyWeighInFormPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

function renderRemotePage(
  fetchMock: ReturnType<typeof vi.fn>,
  initialEntries = ['/weigh-ins'],
  userId = 'member-1',
  withChallengeSwitch = false,
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://weigh-ins-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)

  return render(remotePage(initialEntries, userId, withChallengeSwitch))
}

describe('DailyWeighInFormPage', () => {
  it('shows accessible errors for missing weight and future dates', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2099-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields before saving.',
    )
    expect(
      screen.getByText('Weigh-in date cannot be in the future.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Weight must be a positive finite number.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Weight in kg')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('creates a local weigh-in and reports the created state', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.change(screen.getByLabelText('Private note (optional)'), {
      target: { value: 'Morning reading.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in created in local storage.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/91.8 kg/)).toBeInTheDocument()
    expect(screen.getAllByText('Morning reading.')).toHaveLength(1)
  })

  it('updates the same date instead of adding a duplicate', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in created in local storage.'),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in updated in local storage.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/91.5 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/91.8 kg/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps weight gains valid when they are a positive saved value', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '95.4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(screen.getByText(/95.4 kg/)).toBeInTheDocument()
    })
    expect(
      screen.queryByText('Weight must be a positive finite number.'),
    ).not.toBeInTheDocument()
  })

  it('shows the selected challenge, current privacy rules, and an unavailable second destination', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          createdAt: '2026-09-15T08:00:00.000Z',
          createdBy: 'user-owner',
          endDate: '2027-09-15',
          id: 'challenge-1',
          name: 'Slimpossible 2026',
          ownerId: 'user-owner',
          startDate: '2026-09-15',
          status: 'active',
          updatedAt: '2026-09-15T08:00:00.000Z',
        },
      ]),
    )
    window.localStorage.setItem(
      'slimpossible.local.participants',
      JSON.stringify([
        {
          challengeId: 'challenge-1',
          displayName: 'Alex Participant',
          id: 'participant-1',
          joinedAt: '2026-09-15T08:00:00.000Z',
          startingWeightKg: 92.5,
          status: 'active',
          targetWeightKg: 80,
          userId: 'user-alex',
        },
      ]),
    )
    await renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Slimpossible 2026' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Only this selected challenge receives the weigh-in. No second destination is active.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Additional destination, coming soon',
      }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Active members and the owner can see dates and weights you explicitly choose to share in a group challenge. They never see your private notes; unchecked entries stay private.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Only you can see this note. It is never included in group views.',
      ),
    ).toBeInTheDocument()
  })

  it('uses the authenticated saved participant for remote refresh and same-date correction', async () => {
    const today = dateOffset(0)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          {
            challenge_id: 'challenge-other',
            created_at: '2026-09-17T10:00:00.000Z',
            display_name: 'Another member',
            id: 'participant-other',
            joined_at: '2026-09-17T10:00:00.000Z',
            starting_weight_kg: 86,
            status: 'active',
            target_weight_kg: 75,
            updated_at: '2026-09-17T10:00:00.000Z',
            user_id: 'member-1',
          },
          {
            challenge_id: 'challenge-real',
            created_at: '2026-09-17T10:00:00.000Z',
            display_name: 'Saved member',
            id: 'participant-real',
            joined_at: '2026-09-17T10:00:00.000Z',
            starting_weight_kg: 90,
            status: 'active',
            target_weight_kg: 80,
            updated_at: '2026-09-17T10:00:00.000Z',
            user_id: 'member-1',
          },
        ]),
      )
      .mockResolvedValueOnce(
        response([challengeRow('challenge-real', 'Saved challenge')]),
      )
      .mockResolvedValueOnce(
        response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            id: 'weigh-in-real',
            note: 'Saved note',
            participant_id: 'participant-real',
            recorded_date: today,
            share_with_group: false,
            updated_at: '2026-09-17T10:00:00.000Z',
            weight_kg: 90.5,
          },
        ]),
      )
      .mockResolvedValueOnce(
        response({
          created_at: '2026-09-17T10:00:00.000Z',
          id: 'weigh-in-real',
          note: 'Corrected note',
          participant_id: 'participant-real',
          recorded_date: today,
          share_with_group: true,
          updated_at: '2026-09-17T11:00:00.000Z',
          weight_kg: 90.1,
        }),
      )

    renderRemotePage(fetchMock, ['/weigh-ins?challenge=challenge-real'])

    await waitFor(() => {
      expect(screen.getByText('Saved member')).toBeInTheDocument()
    })
    expect(screen.queryByText('Alex Participant')).not.toBeInTheDocument()
    expect(screen.queryByText('Another member')).not.toBeInTheDocument()
    expect(screen.getByText(/90.5 kg/)).toBeInTheDocument()
    const shareConsent = screen.getByRole('checkbox', {
      name: /Share this date and weight with this group’s active members and owner/,
    })
    fireEvent.click(shareConsent)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '90.1' },
    })
    fireEvent.change(screen.getByLabelText('Private note (optional)'), {
      target: { value: 'Corrected note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(screen.getByText('Weigh-in saved remotely.')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText(/90.1 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/90.5 kg/)).not.toBeInTheDocument()

    const participantRequest = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/participants?'),
    )
    expect(String(participantRequest?.[0])).toContain('user_id=eq.member-1')

    const upsertRequest = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]).includes('/weigh_ins?') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    expect(String(upsertRequest?.[0])).toContain('/weigh_ins')
    expect(String(upsertRequest?.[1]?.body)).toContain('participant-real')
    expect(String(upsertRequest?.[1]?.body)).not.toContain('participant-other')
    expect(JSON.parse(String(upsertRequest?.[1]?.body))).toMatchObject({
      share_with_group: true,
    })
  })

  it('switches selected challenges and saves only to the matching participant', async () => {
    const today = dateOffset(0)
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/participants?')) {
        return Promise.resolve(
          response([
            participantRow(
              'member-1',
              'participant-one',
              'challenge-one',
              'Member in challenge one',
            ),
            participantRow(
              'member-1',
              'participant-two',
              'challenge-two',
              'Member in challenge two',
            ),
          ]),
        )
      }
      if (url.includes('/challenges?')) {
        return Promise.resolve(
          response([
            challengeRow('challenge-one', 'Challenge One'),
            challengeRow('challenge-two', 'Challenge Two'),
          ]),
        )
      }
      if (url.includes('/weigh_ins?') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          note: string
          participant_id: string
          recorded_date: string
          weight_kg: number
        }
        return Promise.resolve(
          response({
            created_at: '2026-09-17T10:00:00.000Z',
            id: 'weigh-in-two',
            note: body.note,
            participant_id: body.participant_id,
            recorded_date: body.recorded_date,
            updated_at: '2026-09-17T10:00:00.000Z',
            weight_kg: body.weight_kg,
          }),
        )
      }
      if (url.includes('participant_id=eq.participant-one')) {
        return Promise.resolve(
          response([
            {
              created_at: '2026-09-17T10:00:00.000Z',
              id: 'weigh-in-one',
              note: 'Challenge one private note',
              participant_id: 'participant-one',
              recorded_date: today,
              updated_at: '2026-09-17T10:00:00.000Z',
              weight_kg: 90,
            },
          ]),
        )
      }
      return Promise.resolve(response([]))
    })
    renderRemotePage(
      fetchMock,
      ['/weigh-ins?challenge=challenge-one'],
      'member-1',
      true,
    )

    await screen.findByText('Challenge one private note')
    expect(screen.getByRole('heading', { name: 'Challenge One' })).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch selected challenge' }),
    )

    await screen.findByText('Member in challenge two')
    await screen.findByRole('form', { name: 'Daily weigh-in form' })
    expect(screen.getByRole('heading', { name: 'Challenge Two' })).toBeVisible()
    expect(
      screen.queryByText('Challenge one private note'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Weight in kg')).toHaveValue(null)
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '87.6' },
    })
    fireEvent.change(screen.getByLabelText('Private note (optional)'), {
      target: { value: 'Challenge two private note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await screen.findByText('Weigh-in saved remotely.')
    const writeCall = fetchMock.mock.calls.find(
      (call) =>
        String(call[0]).includes('/weigh_ins?') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    const writeBody = JSON.parse(String(writeCall?.[1]?.body)) as {
      participant_id: string
    }
    expect(writeBody.participant_id).toBe('participant-two')
  })

  it('clears the previous account entry and draft while another account loads', async () => {
    const today = dateOffset(0)
    let resolveSecondAccount!: (result: Response) => void
    const secondAccountParticipants = new Promise<Response>((resolve) => {
      resolveSecondAccount = resolve
    })
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      void _init
      const url = String(input)
      if (
        url.includes('/participants?') &&
        url.includes('user_id=eq.member-1')
      ) {
        return Promise.resolve(
          response([
            participantRow(
              'member-1',
              'participant-one',
              'challenge-one',
              'First account',
            ),
          ]),
        )
      }
      if (
        url.includes('/participants?') &&
        url.includes('user_id=eq.member-2')
      ) {
        return secondAccountParticipants
      }
      if (url.includes('/challenges?')) {
        return Promise.resolve(
          response([challengeRow('challenge-one', 'Challenge One')]),
        )
      }
      if (url.includes('participant_id=eq.participant-one')) {
        return Promise.resolve(
          response([
            {
              created_at: '2026-09-17T10:00:00.000Z',
              id: 'weigh-in-one',
              note: 'First account private note',
              participant_id: 'participant-one',
              recorded_date: today,
              updated_at: '2026-09-17T10:00:00.000Z',
              weight_kg: 91,
            },
          ]),
        )
      }
      if (url.includes('participant_id=eq.participant-two')) {
        return Promise.resolve(
          response([
            {
              created_at: '2026-09-17T10:00:00.000Z',
              id: 'weigh-in-two',
              note: 'Second account private note',
              participant_id: 'participant-two',
              recorded_date: today,
              updated_at: '2026-09-17T10:00:00.000Z',
              weight_kg: 81,
            },
          ]),
        )
      }
      return Promise.resolve(response([]))
    })
    const view = renderRemotePage(fetchMock, [
      '/weigh-ins?challenge=challenge-one',
    ])

    await screen.findByText('First account private note')
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '89.7' },
    })
    fireEvent.change(screen.getByLabelText('Private note (optional)'), {
      target: { value: 'Unsaved first-account draft' },
    })
    view.rerender(
      remotePage(['/weigh-ins?challenge=challenge-one'], 'member-2'),
    )

    await screen.findByText(
      'Loading your selected challenge and saved weigh-ins…',
    )
    expect(
      screen.queryByText('First account private note'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Daily weigh-in form' }),
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(resolveSecondAccount).toBeTypeOf('function')
    })
    resolveSecondAccount(
      response([
        participantRow(
          'member-2',
          'participant-two',
          'challenge-one',
          'Second account',
        ),
      ]),
    )

    await screen.findByText('Second account private note')
    await screen.findByRole('form', { name: 'Daily weigh-in form' })
    expect(
      screen.queryByText('First account private note'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Weight in kg')).toHaveValue(null)
    expect(screen.getByLabelText('Private note (optional)')).toHaveValue('')
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]).includes('/weigh_ins?') &&
          (call[1] as RequestInit | undefined)?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('does not show a form or write attempt when the signed-in user lacks a saved participant', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response([
          {
            challenge_id: 'challenge-real',
            created_at: '2026-09-17T10:00:00.000Z',
            display_name: 'Another member',
            id: 'participant-other',
            joined_at: '2026-09-17T10:00:00.000Z',
            starting_weight_kg: 86,
            status: 'active',
            target_weight_kg: 75,
            updated_at: '2026-09-17T10:00:00.000Z',
            user_id: 'other-member',
          },
        ]),
      )
      .mockResolvedValueOnce(response([]))

    renderRemotePage(fetchMock)

    await waitFor(() => {
      expect(
        screen.getByText(/No saved participant is available/),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('form', { name: 'Daily weigh-in form' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Set up a challenge' }),
    ).toHaveAttribute('href', '/challenge/setup')
    expect(
      screen.getByRole('link', { name: 'Enroll a participant' }),
    ).toHaveAttribute('href', '/challenge/participants/enroll')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the form hidden while the selected participant is loading', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    renderRemotePage(fetchMock)

    expect(
      await screen.findByText(
        'Loading your selected challenge and saved weigh-ins…',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('form', { name: 'Daily weigh-in form' }),
    ).not.toBeInTheDocument()
  })

  it('reports participant-load and save failures without claiming a save', async () => {
    const loadFailure = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/participants?')) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'unavailable' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
          }),
        )
      }
      return Promise.resolve(response([]))
    })
    renderRemotePage(loadFailure)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load the participants.',
    )
    expect(
      screen.queryByRole('form', { name: 'Daily weigh-in form' }),
    ).not.toBeInTheDocument()

    cleanup()
    window.localStorage.clear()

    const saveFailure = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/participants?')) {
          return Promise.resolve(
            response([
              participantRow(
                'member-1',
                'participant-one',
                'challenge-one',
                'Saved member',
              ),
            ]),
          )
        }
        if (url.includes('/challenges?')) {
          return Promise.resolve(
            response([challengeRow('challenge-one', 'Saved challenge')]),
          )
        }
        if (url.includes('/weigh_ins?') && init?.method === 'POST') {
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'unavailable' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 500,
            }),
          )
        }
        return Promise.resolve(response([]))
      },
    )
    renderRemotePage(saveFailure, ['/weigh-ins?challenge=challenge-one'])

    await screen.findByText('Saved member')
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '86.2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save the weigh-in.',
    )
    expect(
      screen.queryByText('Weigh-in saved remotely.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('No weigh-ins saved yet.')).toBeInTheDocument()
  })

  it('orders history, keeps missing days absent, and edits an existing entry', async () => {
    await renderPage()

    const today = dateOffset(0)
    const missingDate = dateOffset(-1)
    const olderDate = dateOffset(-2)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in created in local storage.'),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: olderDate },
    })
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '92.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    const historyItems = screen.getAllByRole('listitem')
    expect(historyItems[0]).toHaveTextContent(today)
    expect(historyItems[1]).toHaveTextContent(olderDate)
    expect(screen.queryByText(new RegExp(missingDate))).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Missing calendar days stay absent; no record or change is created for them.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: `Edit weight ${today}` }),
    )
    expect(
      screen.getByRole('button', { name: 'Update weight' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in updated in local storage.'),
      ).toBeInTheDocument()
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(
      screen.getByText(new RegExp(`${today}: 91.5 kg`)),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(new RegExp(`${today}: 91.8 kg`)),
    ).not.toBeInTheDocument()
  })
})

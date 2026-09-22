import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '../auth/AuthContext'
import { DailyWeighInFormPage } from './DailyWeighInFormPage'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function renderPage() {
  render(
    <MemoryRouter>
      <DailyWeighInFormPage />
    </MemoryRouter>,
  )
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

function renderRemotePage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://weigh-ins-project.supabase.co')
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
        <DailyWeighInFormPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('DailyWeighInFormPage', () => {
  it('shows accessible errors for missing weight and future dates', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2099-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

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
    renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Morning reading.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in created in local storage.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/91.8 kg/)).toBeInTheDocument()
    expect(screen.getAllByText('Morning reading.')).toHaveLength(1)
  })

  it('updates the same date instead of adding a duplicate', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in created in local storage.'),
      ).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(
        screen.getByText('Weigh-in updated in local storage.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/91.5 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/91.8 kg/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('uses the authenticated saved participant for remote refresh and same-date correction', async () => {
    const today = dateOffset(0)
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
        response([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            id: 'weigh-in-real',
            note: 'Saved note',
            participant_id: 'participant-real',
            recorded_date: today,
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
          updated_at: '2026-09-17T11:00:00.000Z',
          weight_kg: 90.1,
        }),
      )

    renderRemotePage(fetchMock)

    await waitFor(() => {
      expect(screen.getByText('Saved member')).toBeInTheDocument()
    })
    expect(screen.queryByText('Alex Participant')).not.toBeInTheDocument()
    expect(screen.queryByText('Another member')).not.toBeInTheDocument()
    expect(screen.getByText(/90.5 kg/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '90.1' },
    })
    fireEvent.change(screen.getByLabelText('Note (optional)'), {
      target: { value: 'Corrected note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(screen.getByText('Weigh-in saved remotely.')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText(/90.1 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/90.5 kg/)).not.toBeInTheDocument()

    const participantRequest = fetchMock.mock.calls[0]
    expect(String(participantRequest?.[0])).toContain('user_id=eq.member-1')

    const upsertRequest = fetchMock.mock.calls[2]
    expect(String(upsertRequest?.[0])).toContain('/weigh_ins')
    expect(String(upsertRequest?.[1]?.body)).toContain('participant-real')
    expect(String(upsertRequest?.[1]?.body)).not.toContain('participant-other')
  })

  it('does not show a form or write attempt when the signed-in user lacks a saved participant', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('orders history, keeps missing days absent, and edits an existing entry', async () => {
    renderPage()

    const today = dateOffset(0)
    const missingDate = dateOffset(-1)
    const olderDate = dateOffset(-2)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

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

    fireEvent.click(screen.getByRole('button', { name: `Edit ${today}` }))
    expect(
      screen.getByRole('button', { name: 'Update weigh-in' }),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weigh-in' }))

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

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

function renderRemotePage(userId: string) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  render(
    <AuthProvider
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: `${userId}@example.com`, id: userId },
      }}
    >
      <MemoryRouter>
        <DailyWeighInFormPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('DailyWeighInFormPage', () => {
  it('shows an actionable empty-membership state for the authenticated user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderRemotePage('user-empty')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'You are not enrolled in a challenge yet. Ask the challenge owner to add your account.',
      )
    })
    expect(screen.getByRole('button', { name: 'Save weigh-in' })).toBeDisabled()
  })

  it('switches memberships and writes the persisted membership UUID', async () => {
    const membershipOne = {
      challenge_id: 'challenge-one',
      created_at: '2026-09-17T10:00:00.000Z',
      display_name: 'Alex',
      id: 'membership-one',
      joined_at: '2026-09-17T10:00:00.000Z',
      starting_weight_kg: 92.5,
      status: 'active',
      target_weight_kg: 80,
      updated_at: '2026-09-17T10:00:00.000Z',
      user_id: 'user-switch',
    }
    const membershipTwo = {
      ...membershipOne,
      challenge_id: 'challenge-two',
      id: 'membership-two',
    }
    const savedWeighIn = {
      created_at: '2026-09-17T10:00:00.000Z',
      id: 'weigh-in-two',
      note: null,
      participant_id: 'membership-two',
      recorded_date: '2026-09-21',
      updated_at: '2026-09-17T10:00:00.000Z',
      weight_kg: 91.8,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([membershipOne, membershipTwo]), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(savedWeighIn), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderRemotePage('user-switch')

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: /challenge-one/ }),
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Challenge membership'), {
      target: { value: 'membership-two' },
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save weigh-in' }),
      ).toBeEnabled()
    })
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '91.8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weigh-in' }))

    await waitFor(() => {
      expect(screen.getByText('Weigh-in saved remotely.')).toBeInTheDocument()
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'user_id=eq.user-switch',
    )
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        String(init?.body).includes('membership-two'),
      ),
    ).toBe(true)
  })

  it('reloads memberships when the authenticated account changes', async () => {
    const membership = {
      challenge_id: 'challenge-account',
      created_at: '2026-09-17T10:00:00.000Z',
      display_name: 'Account member',
      id: 'membership-account',
      joined_at: '2026-09-17T10:00:00.000Z',
      starting_weight_kg: 92.5,
      status: 'active',
      target_weight_kg: 80,
      updated_at: '2026-09-17T10:00:00.000Z',
      user_id: 'user-a',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([membership]), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderRemotePage('user-a')

    await waitFor(() => {
      expect(screen.getByText('Account member')).toBeInTheDocument()
    })

    cleanup()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ...membership, user_id: 'user-b' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderRemotePage('user-b')

    await waitFor(() => {
      expect(screen.getByText('Account member')).toBeInTheDocument()
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('user_id=eq.user-a')
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('user_id=eq.user-b')
  })

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

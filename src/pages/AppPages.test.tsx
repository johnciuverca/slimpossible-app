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
import { HomePage } from './AppPages'

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
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('owner_id=eq.member-1'),
      expect.anything(),
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
})

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
import { ChallengeInvitesPage } from './ChallengeInvitesPage'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function renderOwner(
  fetchMock: ReturnType<typeof vi.fn>,
  initialEntry = '/challenge/invites?challenge=challenge-1',
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://invites-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthProvider
      initialState={{
        error: null,
        status: 'signed-in',
        user: { email: 'owner@example.com', id: 'owner-1' },
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <ChallengeInvitesPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

const challenge = {
  created_at: '2026-09-22T10:00:00.000Z',
  created_by: 'owner-1',
  description: null,
  end_date: '2026-10-01',
  id: 'challenge-1',
  name: 'Autumn challenge',
  owner_id: 'owner-1',
  start_date: '2026-09-22',
  status: 'active',
  target_weight_kg: null,
  updated_at: '2026-09-22T10:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ChallengeInvitesPage', () => {
  it('creates a link without asking the owner for a participant identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([challenge]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response([
          {
            challenge_id: 'challenge-1',
            expires_at: '2026-10-29T23:59:59.000Z',
            invite_id: 'invite-1',
            token: 'raw-invite-token',
          },
        ]),
      )
    renderOwner(fetchMock)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create invite link' }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }))

    await waitFor(() =>
      expect(
        screen.getByText(/\/invite\/raw-invite-token/),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByLabelText('Participant identifier'),
    ).not.toBeInTheDocument()
  })

  it('lets the owner revoke an active link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([challenge]))
      .mockResolvedValueOnce(
        response([
          {
            challenge_id: 'challenge-1',
            created_at: '2026-09-22T10:00:00.000Z',
            expires_at: '2026-10-29T23:59:59.000Z',
            invite_id: 'invite-1',
            revoked_at: null,
          },
        ]),
      )
      .mockResolvedValueOnce(response(true))
    renderOwner(fetchMock)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Revoke link' }),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Revoke link' }))

    await waitFor(() =>
      expect(screen.getByText('Status: revoked')).toBeInTheDocument(),
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not offer group invitation actions for a personal challenge', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((request: RequestInfo | URL) => {
        const requestUrl =
          typeof request === 'object' && request !== null && 'url' in request
            ? String(request.url)
            : String(request)
        return response(
          requestUrl.includes('/challenges?')
            ? [{ ...challenge, challenge_kind: 'personal' }]
            : [],
        )
      })
    renderOwner(fetchMock)

    expect(
      await screen.findByText(/Personal challenges are private/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create invite link' }),
    ).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('create_challenge_invite'),
      ),
    ).toBe(false)
  })
})

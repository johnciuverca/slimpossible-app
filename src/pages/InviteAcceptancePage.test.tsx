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
import { InviteAcceptancePage } from './InviteAcceptancePage'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function renderInvite(
  fetchMock: ReturnType<typeof vi.fn>,
  status: 'signed-in' | 'signed-out',
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://invites-project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key')
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthProvider
      initialState={
        status === 'signed-in'
          ? {
              error: null,
              status: 'signed-in',
              user: { email: 'member@example.com', id: 'member-1' },
            }
          : { error: null, status: 'signed-out', user: null }
      }
    >
      <MemoryRouter initialEntries={['/invite/raw-token']}>
        <InviteAcceptancePage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

const activePreview = {
  challenge_id: 'challenge-1',
  challenge_name: 'Autumn challenge',
  expires_at: '2026-09-29T23:59:59.000Z',
  invite_id: 'invite-1',
  revoked_at: null,
  status: 'active',
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('InviteAcceptancePage', () => {
  it('preserves the invitation route while asking a signed-out user to log in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([activePreview]))
    renderInvite(fetchMock, 'signed-out')

    await waitFor(() =>
      expect(screen.getByText('Autumn challenge')).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('link', { name: 'Sign in to accept' }),
    ).toHaveAttribute('href', '/login')
    expect(screen.getByText(/return here to accept/)).toBeInTheDocument()
  })

  it('accepts after login and sends no user-entered identity to the RPC', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([activePreview]))
      .mockResolvedValueOnce(
        response({
          challenge_id: 'challenge-1',
          created_at: '2026-09-22T10:00:00.000Z',
          display_name: 'Accepted member',
          id: 'participant-1',
          joined_at: '2026-09-22T10:00:00.000Z',
          starting_weight_kg: 92.5,
          status: 'active',
          target_weight_kg: 80,
          updated_at: '2026-09-22T10:00:00.000Z',
          user_id: 'member-1',
        }),
      )
    renderInvite(fetchMock, 'signed-in')

    await waitFor(() =>
      expect(
        screen.getByRole('form', { name: 'Accept invitation form' }),
      ).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Accepted member' },
    })
    fireEvent.change(screen.getByLabelText('Starting weight in kg'), {
      target: { value: '92.5' },
    })
    fireEvent.change(screen.getByLabelText('Target weight in kg'), {
      target: { value: '80' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join challenge' }))

    await waitFor(() =>
      expect(screen.getByText(/Your membership is ready/)).toBeInTheDocument(),
    )
    const requestBody = String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)
    expect(requestBody).toContain('participant_display_name')
    expect(requestBody).not.toContain('user_id')
  })

  it('explains expired and revoked invitations', async () => {
    const expiredFetch = vi
      .fn()
      .mockResolvedValue(response([{ ...activePreview, status: 'expired' }]))
    renderInvite(expiredFetch, 'signed-out')
    await waitFor(() =>
      expect(
        screen.getByText('This invitation is expired.'),
      ).toBeInTheDocument(),
    )
    cleanup()

    const revokedFetch = vi
      .fn()
      .mockResolvedValue(response([{ ...activePreview, status: 'revoked' }]))
    renderInvite(revokedFetch, 'signed-out')
    await waitFor(() =>
      expect(
        screen.getByText('This invitation is revoked.'),
      ).toBeInTheDocument(),
    )
  })
})

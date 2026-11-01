import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../auth/context'
import * as persistenceModule from '../data/persistence'
import type { Challenge } from '../models/challenge'
import { createChallengeFixture } from '../models/fixtures'
import { ChallengeManagementPage } from './ChallengeManagementPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function authValue(id = 'user-owner'): AuthContextValue {
  return {
    changePassword: async () => false,
    requestEmailChange: async () => true,
    saveProfileName: async () => true,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => true,
    retrySession: () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
    state: {
      status: 'signed-in',
      user: { email: `${id}@example.invalid`, id },
      error: null,
    },
  }
}

function renderPage(id = 'user-owner') {
  return render(
    <AuthContext.Provider value={authValue(id)}>
      <MemoryRouter>
        <ChallengeManagementPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function installPersistence(initial: Challenge[]) {
  const challenges = [...initial]
  const repository = {
    archive: vi.fn(async (id: string) => {
      const index = challenges.findIndex((challenge) => challenge.id === id)
      if (index < 0) return { data: null, state: 'empty' as const }
      const current = challenges[index]
      const archived: Challenge = {
        ...current,
        archivedFromStatus: current.status as 'draft' | 'active' | 'completed',
        status: 'archived',
      }
      challenges[index] = archived
      return { data: archived, state: 'success' as const }
    }),
    listOwned: vi.fn(async () => ({
      data: [...challenges],
      state: 'success' as const,
    })),
    restore: vi.fn(
      async (id: string, targetStatus?: 'draft' | 'active' | 'completed') => {
        const index = challenges.findIndex((challenge) => challenge.id === id)
        if (index < 0) return { data: null, state: 'empty' as const }
        const current = challenges[index]
        const status =
          current.endDate < new Date().toISOString().slice(0, 10)
            ? 'completed'
            : current.archivedFromStatus === 'draft'
              ? 'active'
              : (current.archivedFromStatus ?? targetStatus ?? 'active')
        const restored: Challenge = {
          ...current,
          archivedFromStatus: null,
          status,
        }
        challenges[index] = restored
        return { data: restored, state: 'success' as const }
      },
    ),
  }
  const persistence = {
    mode: 'remote' as const,
    repositories: { challenges: repository },
  } as unknown as ReturnType<typeof persistenceModule.createPersistence>
  vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(persistence)
  return { challenges, repository }
}

describe('ChallengeManagementPage', () => {
  it('lists active and completed group challenges with their real status and archives through the repository', async () => {
    const { repository } = installPersistence([
      createChallengeFixture({
        id: 'active-one',
        name: 'Active plan',
        status: 'active',
      }),
      createChallengeFixture({
        id: 'draft-one',
        name: 'Second active plan',
        status: 'active',
      }),
      createChallengeFixture({
        id: 'done-one',
        name: 'Completed plan',
        status: 'completed',
      }),
      createChallengeFixture({
        id: 'personal-one',
        kind: 'personal',
        name: 'Private plan',
      }),
      createChallengeFixture({ id: 'other-owner', ownerId: 'another-owner' }),
    ])

    renderPage()

    const activePanel = await screen.findByRole('tabpanel')
    expect(within(activePanel).getByText('Active plan')).toBeInTheDocument()
    expect(
      within(activePanel).getByText('Second active plan'),
    ).toBeInTheDocument()
    expect(within(activePanel).getByText('Completed plan')).toBeInTheDocument()
    expect(
      within(activePanel).queryByText('Private plan'),
    ).not.toBeInTheDocument()
    expect(
      within(activePanel).queryByText('other-owner'),
    ).not.toBeInTheDocument()

    const activeCard = screen
      .getByRole('heading', { name: 'Active plan' })
      .closest('article')
    expect(activeCard).not.toBeNull()
    fireEvent.click(
      within(activeCard as HTMLElement).getByRole('button', {
        name: 'Archive',
      }),
    )

    await waitFor(() =>
      expect(repository.archive).toHaveBeenCalledWith('active-one'),
    )
    expect(
      await screen.findByText(
        'Active plan was archived. Group history remains available to current authorized viewers.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
    const archivedPanel = screen.getByRole('tabpanel')
    expect(within(archivedPanel).getByText('Active plan')).toBeInTheDocument()
    expect(
      within(archivedPanel).getByRole('button', { name: 'Restore' }),
    ).toBeInTheDocument()
    expect(
      within(archivedPanel).queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['success', false],
    ['error', false],
    ['rejection', false],
    ['success', true],
    ['error', true],
    ['rejection', true],
  ] as const)(
    'discards a pending %s across account changes and a return to the original account',
    async (outcome, switchBack) => {
      const challenge = createChallengeFixture({
        name: 'Private old account',
        id: 'old-action',
      })
      const { repository } = installPersistence([challenge])
      let resolve!: (
        value: Awaited<ReturnType<typeof repository.archive>>,
      ) => void
      let reject!: (reason: Error) => void
      repository.archive.mockImplementationOnce(
        () =>
          new Promise((done, fail) => {
            resolve = done
            reject = fail
          }),
      )
      const view = renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
      await waitFor(() => expect(repository.archive).toHaveBeenCalledOnce())
      const changeAccount = (id: string) =>
        view.rerender(
          <AuthContext.Provider value={authValue(id)}>
            <MemoryRouter>
              <ChallengeManagementPage />
            </MemoryRouter>
          </AuthContext.Provider>,
        )
      changeAccount('another-owner')
      expect(screen.queryByText('Private old account')).not.toBeInTheDocument()
      if (switchBack) {
        changeAccount('user-owner')
        await screen.findByRole('button', { name: 'Archive' })
      }
      await act(async () => {
        if (outcome === 'rejection') reject(new Error('Old account failure'))
        else if (outcome === 'error')
          resolve({
            state: 'error',
            error: { kind: 'request', message: 'Old failure' },
          } as never)
        else
          resolve({
            state: 'success',
            data: { ...challenge, status: 'archived' },
          })
      })
      if (switchBack)
        expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
      expect(
        screen.queryByText(
          /was archived|could not be archived|Old account failure/,
        ),
      ).not.toBeInTheDocument()
      if (switchBack)
        expect(screen.getByText('Private old account')).toBeInTheDocument()
      else
        expect(
          screen.queryByText('Private old account'),
        ).not.toBeInTheDocument()
    },
  )

  it.each(['missing-rpc', 'rejected-request'] as const)(
    'announces and focuses %s failure feedback, keeping Archive available for retry',
    async (failure) => {
      const { repository } = installPersistence([
        createChallengeFixture({ name: 'Retry group' }),
      ])
      if (failure === 'missing-rpc')
        repository.archive.mockResolvedValueOnce({
          state: 'error',
          error: { kind: 'request', message: 'PGRST202: function absent' },
        } as never)
      else
        repository.archive.mockRejectedValueOnce(
          new Error('Network unavailable'),
        )
      renderPage()
      const archive = await screen.findByRole('button', { name: 'Archive' })
      // The live region exists before its text changes for reliable announcements.
      const feedback = screen
        .getAllByRole('status')
        .find((node) => node.getAttribute('aria-live') === 'polite')!
      expect(feedback).toHaveTextContent('')
      fireEvent.click(archive)
      await waitFor(() =>
        expect(feedback).toHaveTextContent(
          'This challenge could not be archived. Refresh and check its current status.',
        ),
      )
      expect(feedback).toHaveAttribute('aria-atomic', 'true')
      expect(feedback).toHaveFocus()
      expect(archive).toBeEnabled()
      expect(screen.getByText('Retry group')).toBeInTheDocument()
    },
  )

  it('uses the established day.month.year date contract', async () => {
    installPersistence([
      createChallengeFixture({
        startDate: '2026-01-02',
        endDate: '2027-03-04',
      }),
    ])
    renderPage()
    expect(
      await screen.findByText('02.01.2026 – 04.03.2027'),
    ).toBeInTheDocument()
  })

  it('restores a historical Draft archive as Active without offering Draft', async () => {
    const archived = createChallengeFixture({
      id: 'old-draft',
      name: 'Historical group',
      status: 'archived',
      archivedFromStatus: 'draft',
      endDate: '2099-01-01',
    })
    const { repository } = installPersistence([archived])
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: /Archived/ }))
    expect(screen.getByText('Restores as Active.')).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Draft' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() =>
      expect(repository.restore).toHaveBeenCalledWith('old-draft', undefined),
    )
    expect(
      await screen.findByText(/Historical group was restored as Active/),
    ).toBeInTheDocument()
  })

  it('restores a tracked completed challenge as Completed after its end date', async () => {
    const archived = createChallengeFixture({
      id: 'completed-archive',
      name: 'Ended plan',
      endDate: '2020-01-01',
      status: 'archived',
      archivedFromStatus: 'active',
    })
    const { repository } = installPersistence([archived])
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: /Archived/ }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText(/Restores as Completed/)).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: /Restore/ }))

    await waitFor(() =>
      expect(repository.restore).toHaveBeenCalledWith(
        'completed-archive',
        undefined,
      ),
    )
    expect(
      await screen.findByText(
        'Ended plan was restored as Completed. Previous invitation links stay revoked.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }))
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
})

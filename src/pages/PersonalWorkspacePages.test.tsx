import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../auth/context'
import { createPersistence } from '../data/persistence'
import * as persistenceModule from '../data/persistence'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../models/fixtures'
import { personalWeighInToday } from '../models/personalWeighIn'
import { PersonalDashboardPage } from './PersonalDashboardPage'
import { MyProgressPage } from './MyProgressPage'
import { GoalsPage, GroupDashboardPage } from './AppPages'
import { PersonalEntryActions } from '../components/WeightEntryActions'

function authValue(id = 'user-alex'): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: { id, email: `${id}@example.invalid` },
      error: null,
    },
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => false,
    retrySession: () => undefined,
    signIn: async () => undefined,
    signOut: async () => undefined,
    signUp: async () => undefined,
  }
}
function page(element: React.ReactNode, id = 'user-alex', path = '/dashboard') {
  return (
    <AuthContext.Provider value={authValue(id)}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </AuthContext.Provider>
  )
}
function local() {
  const result = createPersistence({
    status: 'signed-out',
    user: null,
    error: null,
  })
  if (result.mode !== 'local') throw new Error('Expected local fixture')
  return result
}
function seedGroups() {
  window.localStorage.setItem(
    'slimpossible.local.challenges',
    JSON.stringify([
      createChallengeFixture({ ownerId: 'user-alex', createdBy: 'user-alex' }),
    ]),
  )
  window.localStorage.setItem(
    'slimpossible.local.participants',
    JSON.stringify([createParticipantFixture()]),
  )
}

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
)
beforeEach(() => {
  // jsdom lacks native modal behavior; real browser tests cover focus/escape.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShowModal,
    )
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

describe('personal Dashboard and My Progress', () => {
  it('keeps a failed deletion in the separate dialog and does not remove the author record', async () => {
    const storage = local()
    await storage.repositories.personalWeighIns.save('user-alex', {
      date: '2026-01-01',
      weightKg: 90,
      sharedChallengeIds: [],
    })
    vi.spyOn(storage.repositories.personalWeighIns, 'delete').mockRejectedValue(
      new Error('Unavailable'),
    )
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
    render(page(<MyProgressPage />, 'user-alex', '/progress'))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete 2026-01-01' }),
    )
    const deletion = await screen.findByRole('dialog', {
      name: 'Delete weight?',
    })
    fireEvent.click(
      within(deletion).getByRole('button', { name: 'Delete weight' }),
    )
    expect(await within(deletion).findByRole('alert')).toHaveTextContent(
      'Deletion could not be confirmed',
    )
    fireEvent.click(within(deletion).getByRole('button', { name: 'Cancel' }))
    expect(
      await storage.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({ state: 'success', data: [{ weightKg: 90 }] })
  })
  it('Group actions resolve only current-author entries explicitly shared with the selected group, without displaying notes', async () => {
    seedGroups()
    window.localStorage.setItem(
      'slimpossible.local.personal-weigh-ins',
      JSON.stringify([
        {
          id: 'own-shared',
          userId: 'user-alex',
          date: '2026-01-01',
          weightKg: 90,
          note: 'Own private note',
          sharedChallengeIds: ['challenge-1'],
        },
        {
          id: 'own-unshared',
          userId: 'user-alex',
          date: '2026-01-02',
          weightKg: 89,
          note: 'Other private note',
          sharedChallengeIds: [],
        },
        {
          id: 'other-author',
          userId: 'second-account',
          date: '2026-01-03',
          weightKg: 70,
          note: 'Never authorized',
          sharedChallengeIds: ['challenge-1'],
        },
      ]),
    )
    const view = render(
      page(<PersonalEntryActions challengeId="challenge-1" />),
    )
    const own = await screen.findByRole('list', {
      name: 'Your own shared group entries',
    })
    await waitFor(() =>
      expect(within(own).getAllByRole('button')).toHaveLength(2),
    )
    expect(screen.queryByText('Own private note')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit weight 2026-01-02' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit weight 2026-01-03' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit weight 2026-01-01' }),
    )
    expect(screen.getByLabelText('Private note (optional)')).toHaveValue(
      'Own private note',
    )
    view.rerender(
      page(
        <PersonalEntryActions challengeId="challenge-1" />,
        'second-account',
      ),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Own private note')).not.toBeInTheDocument()
    await screen.findByRole('button', { name: 'Edit weight 2026-01-03' })
    expect(
      screen.queryByRole('button', { name: 'Edit weight 2026-01-01' }),
    ).not.toBeInTheDocument()
  })
  it.each([0, 1, 2])(
    'offers invite destinations for %s owned eligible groups only, without creating invitations',
    async (count) => {
      const storage = local()
      const createInvite = vi.spyOn(storage.repositories.invites, 'create')
      vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
      window.localStorage.setItem(
        'slimpossible.local.challenges',
        JSON.stringify([
          ...Array.from({ length: count }, (_, index) =>
            createChallengeFixture({
              id: `owned-${index}`,
              name: `Owned group ${index + 1}`,
              ownerId: 'user-alex',
              createdBy: 'user-alex',
              kind: 'group',
            }),
          ),
          createChallengeFixture({
            id: 'personal',
            name: 'Owned personal goal',
            ownerId: 'user-alex',
            kind: 'personal',
          }),
          createChallengeFixture({
            id: 'archived',
            name: 'Archived owned group',
            ownerId: 'user-alex',
            status: 'archived',
          }),
          createChallengeFixture({
            id: 'joined',
            name: 'Joined group',
            ownerId: 'someone-else',
          }),
        ]),
      )
      window.localStorage.setItem(
        'slimpossible.local.participants',
        JSON.stringify([createParticipantFixture({ challengeId: 'joined' })]),
      )
      render(page(<PersonalDashboardPage />))
      await screen.findByText('No record yet')
      expect(
        screen.getByRole('link', { name: 'Create challenge' }),
      ).toHaveAttribute('href', '/challenge/setup')
      expect(
        screen.queryByRole('list', { name: 'Separate challenge summaries' }),
      ).not.toBeInTheDocument()
      if (count === 1) {
        const invite = await screen.findByRole('link', {
          name: 'Invite people',
        })
        expect(invite).toHaveAttribute(
          'href',
          '/challenge/invites?challenge=owned-0',
        )
      } else {
        const invite = screen.getByRole('button', { name: 'Invite people' })
        await waitFor(() => expect(invite).toBeEnabled())
        fireEvent.click(invite)
        if (count === 0)
          await screen.findByText(/Create a group challenge first/)
        else {
          const chooser = screen.getByRole('combobox', {
            name: 'Choose a group you own',
          })
          expect(chooser).toHaveValue('')
          expect(
            screen.queryByRole('link', { name: 'Continue to invitations' }),
          ).not.toBeInTheDocument()
          expect(within(chooser).getAllByRole('option')).toHaveLength(3)
          fireEvent.change(chooser, { target: { value: 'owned-1' } })
          expect(
            screen.getByRole('link', { name: 'Continue to invitations' }),
          ).toHaveAttribute('href', '/challenge/invites?challenge=owned-1')
        }
      }
      expect(createInvite).not.toHaveBeenCalled()
      expect(screen.queryByText('Owned personal goal')).not.toBeInTheDocument()
      expect(screen.queryByText('Archived owned group')).not.toBeInTheDocument()
      expect(screen.queryByText('Joined group')).not.toBeInTheDocument()
    },
  )

  it('clears invitation choices and session information when the account changes', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify(
        [0, 1].map((index) =>
          createChallengeFixture({
            id: `owned-${index}`,
            name: `First account group ${index}`,
            ownerId: 'user-alex',
          }),
        ),
      ),
    )
    const rendered = render(page(<PersonalDashboardPage />))
    const invite = screen.getByRole('button', { name: 'Invite people' })
    await waitFor(() => expect(invite).toBeEnabled())
    fireEvent.click(invite)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'owned-1' },
    })
    expect(
      screen.getByRole('link', { name: 'Continue to invitations' }),
    ).toBeInTheDocument()
    rendered.rerender(page(<PersonalDashboardPage />, 'second-user'))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Continue to invitations' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('user-alex@example.invalid'),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'About you' })).getByText(
        'second-user@example.invalid',
      ),
    ).toBeInTheDocument()
  })

  it.each([
    ['Group', GroupDashboardPage, '/group?challenge=missing'],
    ['Goals', GoalsPage, '/goals?challenge=missing'],
  ])(
    'keeps %s recording independent of failed optional challenge loading',
    async (_name, Page, path) => {
      const storage = local()
      vi.spyOn(
        storage.repositories.challenges,
        'listVisibleToUser',
      ).mockResolvedValue({
        state: 'error',
        error: { kind: 'request', message: 'Unavailable' },
      })
      vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
      render(page(<Page />, 'user-alex', path))
      const action = screen.getByRole('button', { name: 'Record weight' })
      await waitFor(() => expect(action).toBeEnabled())
      fireEvent.click(action)
      const dialog = screen.getByRole('dialog', { name: 'Record weight' })
      expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
      fireEvent.change(within(dialog).getByLabelText('Weight in kg'), {
        target: { value: '81' },
      })
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Save weight' }),
      )
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      )
      expect(
        await storage.repositories.personalWeighIns.listForUser('user-alex'),
      ).toMatchObject({ data: [{ weightKg: 81, sharedChallengeIds: [] }] })
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Record weight' }),
        ).toBeEnabled(),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Record weight' }))
      expect(
        screen.getByRole('dialog', { name: 'Edit weight' }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Weight in kg')).toHaveValue(81)
    },
  )

  it('records a private entry with no challenge and updates logged-today state', async () => {
    render(page(<PersonalDashboardPage />))
    await screen.findByText('No record yet')
    expect(screen.getByText('Not logged today')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit weight' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Record weight' }))
    const dialog = screen.getByRole('dialog', { name: 'Record weight' })
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Weight in kg'), {
      target: { value: '82.1' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Private note/), {
      target: { value: 'Only my note' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save weight' }))
    await screen.findByText('82.1 kg')
    expect(screen.getByText('Logged today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record weight' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Edit weight' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Only my note')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const entries =
      await local().repositories.personalWeighIns.listForUser('user-alex')
    expect(entries).toMatchObject({
      data: [
        {
          note: 'Only my note',
          date: personalWeighInToday(),
          sharedChallengeIds: [],
        },
      ],
    })
  })

  it('preserves today’s explicit share on correction without requesting Dashboard group summaries', async () => {
    seedGroups()
    const storage = local()
    await storage.repositories.personalWeighIns.save('user-alex', {
      date: personalWeighInToday(),
      weightKg: 85,
      note: 'Author only',
      sharedChallengeIds: ['challenge-1'],
    })
    const summary = vi.fn().mockResolvedValue({
      state: 'success',
      data: {
        challengeId: 'challenge-1',
        activeParticipantCount: 1,
        averageCompletionPercentage: 30,
        currentSunday: '2026-10-04',
        previousSunday: '2026-09-27',
        eligibleParticipantCount: 0,
        participantsWithProgressCount: 1,
        participantsWithRecordedWeightCount: 1,
        reachedTargetCount: 0,
        weeklyWinnerCount: 0,
        weeklyWinnerNames: [],
      },
    })
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue({
      mode: 'remote',
      repositories: {
        ...storage.repositories,
        groupProgress: {
          ...storage.repositories.groupProgress,
          getForChallenge: summary,
        },
      },
    })
    render(page(<PersonalDashboardPage />))
    await screen.findByText('85 kg')
    expect(summary).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Record weight' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit weight' })
    expect(
      within(dialog).getByRole('checkbox', { name: 'Slimpossible 2026' }),
    ).toBeChecked()
    fireEvent.change(within(dialog).getByLabelText('Weight in kg'), {
      target: { value: '84' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Update weight' }),
    )
    await screen.findByText('84 kg')
    expect(summary).not.toHaveBeenCalled()
    expect(
      await storage.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({
      data: [{ weightKg: 84, sharedChallengeIds: ['challenge-1'] }],
    })
  })

  it('shows private full history without a membership and confirms deletion', async () => {
    const storage = local()
    await storage.repositories.personalWeighIns.save('user-alex', {
      date: '2026-01-01',
      weightKg: 90,
      note: 'Private history',
      sharedChallengeIds: [],
    })
    render(page(<MyProgressPage />, 'user-alex', '/progress'))
    const table = await screen.findByRole('list', {
      name: 'Your saved personal weigh-ins',
    })
    expect(within(table).getByText('Private history')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /1 saved weigh-ins/ }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-01-01' }))
    let deletion = await screen.findByRole('dialog', { name: 'Delete weight?' })
    expect(deletion).toHaveTextContent('ALL shared groups')
    fireEvent.click(within(deletion).getByRole('button', { name: 'Cancel' }))
    expect(within(table).getByText('90 kg')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-01-01' }))
    deletion = await screen.findByRole('dialog', { name: 'Delete weight?' })
    fireEvent.click(
      within(deletion).getByRole('button', { name: 'Delete weight' }),
    )
    await screen.findByText(/No personal entries yet/)
    expect(
      await storage.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({ state: 'empty' })
  })

  it('keeps personal logging available when optional challenges fail', async () => {
    const storage = local()
    vi.spyOn(
      storage.repositories.challenges,
      'listVisibleToUser',
    ).mockResolvedValue({
      state: 'error',
      error: { kind: 'request', message: 'Unavailable' },
    })
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
    render(page(<PersonalDashboardPage />))
    await screen.findByText('No record yet')
    expect(screen.getByRole('button', { name: 'Record weight' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Record weight' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/New entries can still be saved privately/),
    ).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Weight in kg'), {
      target: { value: '82' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save weight' }))
    await screen.findByText('82 kg')
  })

  it('distinguishes a personal load failure from an empty history', async () => {
    const storage = local()
    vi.spyOn(
      storage.repositories.personalWeighIns,
      'listForUser',
    ).mockResolvedValue({
      state: 'error',
      error: { kind: 'request', message: 'Unavailable' },
    })
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
    render(page(<PersonalDashboardPage />))
    await screen.findAllByText(/Your personal history could not be loaded/)
    expect(screen.queryByText('No record yet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record weight' })).toBeDisabled()
  })

  it('hides old-account notes and closes the editor before new-account data loads', async () => {
    const storage = local()
    await storage.repositories.personalWeighIns.save('user-alex', {
      date: personalWeighInToday(),
      weightKg: 85,
      note: 'Old account secret',
      sharedChallengeIds: [],
    })
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(storage)
    let finish!: (
      result: Awaited<
        ReturnType<typeof storage.repositories.personalWeighIns.listForUser>
      >,
    ) => void
    const original = storage.repositories.personalWeighIns.listForUser
    vi.spyOn(
      storage.repositories.personalWeighIns,
      'listForUser',
    ).mockImplementation((id) =>
      id === 'second-user'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : original(id),
    )
    const rendered = render(page(<MyProgressPage />, 'user-alex', '/progress'))
    await screen.findByText('Old account secret')
    fireEvent.click(
      screen.getByRole('button', {
        name: `Edit weight ${personalWeighInToday()}`,
      }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rendered.rerender(page(<MyProgressPage />, 'second-user', '/progress'))
    expect(screen.queryByText('Old account secret')).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Old account secret'),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    finish({ state: 'empty', data: [] })
    await screen.findByText(/No personal entries yet/)
  })
})

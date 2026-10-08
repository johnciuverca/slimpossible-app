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
  it('records a private entry with no challenge and updates logged-today state', async () => {
    render(page(<PersonalDashboardPage />))
    await screen.findByText('No record yet')
    expect(screen.getByText('Not logged today')).toBeInTheDocument()
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

  it('preserves today’s explicit draft share on correction and refreshes the existing group RPC', async () => {
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
    await waitFor(() => expect(summary).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Edit today’s weight' }))
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
    await waitFor(() => expect(summary).toHaveBeenCalledTimes(2))
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-01-01' }))
    expect(within(table).getByText('90 kg')).toBeInTheDocument()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-01-01' }))
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
    await screen.findByText(/Your personal history could not be loaded/)
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
      screen.getByRole('button', { name: `Edit ${personalWeighInToday()}` }),
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

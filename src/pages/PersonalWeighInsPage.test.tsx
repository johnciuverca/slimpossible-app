import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PersonalWeighInsPage } from './PersonalWeighInsPage'
import { ChallengeSetupPage } from './ChallengeSetupPage'
import { AuthProvider } from '../auth/AuthContext'
import { createPersistence } from '../data/persistence'
import * as persistenceModule from '../data/persistence'

function dateOffset(offset: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider
        initialState={{
          status: 'signed-in',
          error: null,
          user: { id: 'user-alex', email: 'alex@example.invalid' },
        }}
      >
        <PersonalWeighInsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PersonalWeighInsPage', () => {
  it('announces pending deletion and preserves the card if deletion is not confirmed', async () => {
    const persistence = createPersistence({
      status: 'signed-out',
      error: null,
      user: null,
    })
    if (persistence.mode !== 'local') throw new Error('Expected local mode')
    await persistence.repositories.personalWeighIns.save('user-alex', {
      date: dateOffset(0),
      weightKg: 82,
      sharedChallengeIds: [],
    })
    let complete!: (value: { state: 'success'; data: boolean }) => void
    vi.spyOn(
      persistence.repositories.personalWeighIns,
      'delete',
    ).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(
      persistence,
    )
    renderPage()
    await screen.findByText('82 kg')
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Delete weight?' }),
      ).getByRole('button', { name: 'Delete weight' }),
    )
    expect(
      screen.getByRole('button', { name: 'Deleting…' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    complete({ state: 'success', data: false })
    await screen.findByRole('alert')
    expect(screen.getAllByText(/82 kg/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Delete weight' })).toBeEnabled()
    expect(
      screen.queryByText('Weigh-in and its group shares were deleted.'),
    ).not.toBeInTheDocument()
  })
  it('keeps the unavailable-share warning visible and requires confirmation before removing a share', async () => {
    const persistence = createPersistence({
      status: 'signed-out',
      error: null,
      user: null,
    })
    if (persistence.mode !== 'local') throw new Error('Expected local mode')
    const group = await persistence.repositories.challenges.create({
      name: 'Closed group',
      ownerId: 'user-alex',
      createdBy: 'user-alex',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    })
    if (group.state !== 'success') throw new Error('Expected group')
    await persistence.repositories.personalWeighIns.save('user-alex', {
      date: dateOffset(0),
      weightKg: 82,
      sharedChallengeIds: [group.data.id],
    })
    await persistence.repositories.challenges.update(group.data.id, {
      ...group.data,
      status: 'archived',
    })
    renderPage()
    await screen.findByText(/82 kg/)
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(
      screen.getByText(/Saving will remove that unavailable share/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '81.9' },
    })
    expect(
      screen.getByText(/Saving will remove that unavailable share/),
    ).toBeInTheDocument()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(
      await persistence.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({
      data: [{ weightKg: 82, sharedChallengeIds: [group.data.id] }],
    })
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    await screen.findByText(/81.9 kg/)
    expect(
      await persistence.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({ data: [{ sharedChallengeIds: [] }] })
  })

  it('does not strip existing shares when group eligibility could not be loaded', async () => {
    const persistence = createPersistence({
      status: 'signed-out',
      error: null,
      user: null,
    })
    if (persistence.mode !== 'local') throw new Error('Expected local mode')
    const group = await persistence.repositories.challenges.create({
      name: 'Draft group',
      ownerId: 'user-alex',
      createdBy: 'user-alex',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    })
    if (group.state !== 'success') throw new Error('Expected group')
    await persistence.repositories.personalWeighIns.save('user-alex', {
      date: dateOffset(0),
      weightKg: 82,
      sharedChallengeIds: [group.data.id],
    })
    vi.spyOn(
      persistence.repositories.participants,
      'listForUser',
    ).mockResolvedValue({
      state: 'error',
      error: { kind: 'request', message: 'Cannot load memberships' },
    })
    vi.spyOn(persistenceModule, 'createPersistence').mockReturnValue(
      persistence,
    )
    renderPage()
    await screen.findByText(/82 kg/)
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(
      screen.getByText(/Reload before editing a shared entry/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Update weight' }),
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '81.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText(/Reload before correcting a shared entry/)
    expect(
      await persistence.repositories.personalWeighIns.listForUser('user-alex'),
    ).toMatchObject({ data: [{ sharedChallengeIds: [group.data.id] }] })
  })

  it('shares with a setup-created draft group and preserves that share when editing', async () => {
    const setup = render(
      <AuthProvider
        initialState={{
          status: 'signed-in',
          error: null,
          user: { id: 'user-alex', email: 'owner@example.com' },
        }}
      >
        <MemoryRouter>
          <ChallengeSetupPage />
        </MemoryRouter>
      </AuthProvider>,
    )
    await screen.findByRole('textbox', { name: 'Challenge name' })
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Setup draft group' },
    })
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save challenge' }))
    await waitFor(() =>
      expect(
        JSON.parse(
          window.localStorage.getItem('slimpossible.local.challenges') ?? '[]',
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Setup draft group',
            status: 'draft',
          }),
        ]),
      ),
    )
    setup.unmount()
    renderPage()
    const choice = await screen.findByRole('checkbox', {
      name: 'Setup draft group',
    })
    expect(choice).not.toBeChecked()
    fireEvent.click(choice)
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText('Shared with Setup draft group')
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(
      screen.getByRole('checkbox', { name: 'Setup draft group' }),
    ).toBeChecked()
    expect(screen.queryByText(/Saving will remove/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '81.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    await screen.findByText(/81.9 kg/)
    expect(
      screen.getByText('Shared with Setup draft group'),
    ).toBeInTheDocument()
  })

  it('offers only draft/active groups owned by the author or joined as an active member', async () => {
    const persistence = createPersistence({
      status: 'signed-out',
      error: null,
      user: null,
    })
    if (persistence.mode !== 'local') throw new Error('Expected local mode')
    for (const [name, ownerId, kind, status, membership] of [
      ['Draft member', 'other', 'group', 'draft', 'active'],
      ['Withdrawn', 'other', 'group', 'draft', 'withdrawn'],
      ['Invited', 'other', 'group', 'active', 'invited'],
      ['Completed', 'user-alex', 'group', 'completed', null],
      ['Archived', 'user-alex', 'group', 'archived', null],
      ['Personal', 'user-alex', 'personal', 'draft', null],
      ['Outsider', 'other', 'group', 'active', null],
    ] as const) {
      const group = await persistence.repositories.challenges.create({
        name,
        ownerId,
        createdBy: ownerId,
        kind,
        status,
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      })
      if (group.state !== 'success') throw new Error('Expected group')
      if (membership)
        await persistence.repositories.participants.create({
          challengeId: group.data.id,
          userId: 'user-alex',
          displayName: 'Alex',
          status: membership,
          startingWeightKg: 90,
          targetWeightKg: 80,
        })
    }
    renderPage()
    await screen.findByRole('checkbox', { name: 'Draft member' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('records a private weigh-in without a challenge', async () => {
    renderPage()

    await screen.findByRole('form', { name: 'Personal weigh-in form' })
    expect(
      screen.getByText(/You can still save this private weigh-in/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.4' },
    })
    fireEvent.change(screen.getByLabelText(/Private note/), {
      target: { value: 'Only for me.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await screen.findByText('Personal weigh-in saved in this browser.')
    expect(screen.getByText(/82.4 kg/)).toBeInTheDocument()
    expect(screen.getByText('Only for me.')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('allows explicit sharing with multiple eligible groups and starts unchecked', async () => {
    window.localStorage.setItem(
      'slimpossible.local.challenges',
      JSON.stringify([
        {
          id: 'group-one',
          name: 'Group One',
          kind: 'group',
          ownerId: 'user-alex',
          createdBy: 'user-alex',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          status: 'active',
        },
        {
          id: 'group-two',
          name: 'Group Two',
          kind: 'group',
          ownerId: 'user-alex',
          createdBy: 'user-alex',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
          status: 'active',
        },
      ]),
    )
    renderPage()
    await screen.findByRole('checkbox', { name: 'Group One' })

    const firstGroup = screen.getByRole('checkbox', { name: 'Group One' })
    const secondGroup = screen.getByRole('checkbox', { name: 'Group Two' })
    expect(firstGroup).not.toBeChecked()
    expect(secondGroup).not.toBeChecked()
    fireEvent.click(firstGroup)
    fireEvent.click(secondGroup)
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '81.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))

    await screen.findByText(/81.9 kg/)
    expect(
      screen.getByText('Shared with Group One, Group Two'),
    ).toBeInTheDocument()
  })

  it('edits the canonical entry and confirms deletion', async () => {
    renderPage()
    await screen.findByRole('form', { name: 'Personal weigh-in form' })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '83.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText(/83.1 kg/)

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(screen.getByLabelText('Weight in kg')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    await screen.findByText(/82.9 kg/)

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    const deletion = await screen.findByRole('dialog', {
      name: 'Delete weight?',
    })
    expect(deletion).toHaveTextContent('82.9 kg recorded')
    expect(deletion).toHaveTextContent('ALL shared groups')
    fireEvent.click(within(deletion).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(/82.9 kg/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Delete weight?' }),
      ).getByRole('button', { name: 'Delete weight' }),
    )
    await waitFor(() => {
      expect(
        screen.getByText(/No personal weigh-ins saved yet/),
      ).toBeInTheDocument()
    })
  })

  it('keeps one entry per user/date and rejects a conflicting date edit', async () => {
    renderPage()
    await screen.findByRole('form', { name: 'Personal weigh-in form' })

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '83.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText(/83.1 kg/)

    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.7' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText(
      /Edit the saved record to preserve its note and sharing/,
    )
    expect(screen.getByText(/83.1 kg/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Edit weight/ }))
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.7' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    await screen.findByText(/82.7 kg/)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: dateOffset(-1) },
    })
    fireEvent.change(screen.getByLabelText('Weight in kg'), {
      target: { value: '82.2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save weight' }))
    await screen.findByText(/82.2 kg/)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/ })[1])
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: dateOffset(0) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update weight' }))
    await screen.findByText(/A weigh-in already exists for that date/)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/82.7 kg/)).toBeInTheDocument()
  })
})

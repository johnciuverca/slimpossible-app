import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createPersistence } from '../data/persistence'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  createChallengeFixture,
  createParticipantFixture,
} from '../models/fixtures'
import { DashboardGoals } from './DashboardGoals'
import { PersonalDashboardWorkspace } from '../pages/PersonalDashboardPage'

function fixture(kind: 'group' | 'personal' = 'personal') {
  const challenge = createChallengeFixture({
    kind,
    status: 'active',
    ownerId: 'user-alex',
  })
  const participant = createParticipantFixture({
    startingWeightKg: 100,
    targetWeightKg: 90,
    joinedAt: '2026-10-01T00:00:00Z',
  })
  const persistence = createPersistence({
    status: 'signed-out',
    user: null,
    error: null,
  })
  if (persistence.mode === 'unavailable')
    throw new Error('Expected local persistence')
  const change = vi.fn().mockResolvedValue({
    state: 'success',
    data: {
      challengeId: challenge.id,
      startingWeightKg: 100,
      targetWeightKg: 85,
      previousTargetMilestone: null,
    },
  })
  persistence.repositories.participants.changeOwnGroupTarget = change
  const correct = vi.fn().mockResolvedValue({
    state: 'success',
    data: {
      challengeId: challenge.id,
      startingWeightKg: 110,
      targetWeightKg: 90,
    },
  })
  persistence.repositories.participants.correctOwnEnrollmentStartingWeight =
    correct
  persistence.repositories.participants.listOwnGroupTargetMilestones = vi
    .fn()
    .mockResolvedValue({
      state: 'success',
      data: [
        { targetWeightKg: 95, achievedOn: '2026-10-02', state: 'reached' },
      ],
    })
  const workspace = {
    ownerKey: 'first',
    userId: participant.userId,
    persistence,
    personal: {
      key: 'first',
      state: 'ready',
      error: '',
      data: [
        {
          id: 'shared',
          date: '2026-10-03',
          weightKg: 94.8,
          sharedChallengeIds: [challenge.id],
        },
        {
          id: 'private',
          date: '2026-10-04',
          weightKg: 60,
          sharedChallengeIds: [],
          note: 'Private note stays outside Goals',
        },
      ],
    },
    contexts: {
      key: 'first',
      state: 'ready',
      error: '',
      data: {
        challenges: [challenge],
        participants: [
          participant,
          createParticipantFixture({ id: 'peer', userId: 'peer' }),
        ],
      },
    },
    groups: [challenge],
    refresh: vi.fn(),
  } satisfies PersonalWorkspace
  return { workspace, change, correct }
}
function view(workspace: PersonalWorkspace, path = '/dashboard') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <DashboardGoals key={workspace.ownerKey} workspace={workspace} />
    </MemoryRouter>
  )
}
const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
)
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
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
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  if (originalShow)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShow,
    )
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
})

describe('personal-only Dashboard goals', () => {
  it('shows only authorized personal goals with mixed personal and group contexts', () => {
    const { workspace } = fixture()
    workspace.contexts.data.challenges.push(
      createChallengeFixture({
        id: 'group-secret',
        name: 'Hidden group target',
        ownerId: workspace.userId,
      }),
    )
    workspace.contexts.data.participants.push(
      createParticipantFixture({
        challengeId: 'group-secret',
        id: 'group-self',
        targetWeightKg: 73,
      }),
    )
    render(view(workspace))
    expect(
      screen.getByRole('link', { name: 'Slimpossible 2026' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Hidden group target' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Change target/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    ).toBeInTheDocument()
    expect(
      workspace.persistence.repositories.participants
        .listOwnGroupTargetMilestones,
    ).not.toHaveBeenCalled()
  })
  it('group-only users have a minimal personal empty state and no group controls or milestone requests', () => {
    const { workspace } = fixture('group')
    render(view(workspace))
    expect(screen.getByText(/No personal goal yet/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /Change target|Edit starting weight/,
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/your goal$/)).not.toBeInTheDocument()
    expect(
      workspace.persistence.repositories.participants
        .listOwnGroupTargetMilestones,
    ).not.toHaveBeenCalled()
  })
  it.each(['group-secret', 'challenge-1'])(
    'a legacy group URL cannot select a group goal or chart target: %s',
    (requested) => {
      const { workspace } = fixture('group')
      workspace.contexts.data.challenges.push(
        createChallengeFixture({
          kind: 'personal',
          id: 'own-personal',
          ownerId: workspace.userId,
          name: 'Own personal goal',
        }),
      )
      workspace.contexts.data.participants.push(
        createParticipantFixture({
          id: 'personal-self',
          challengeId: 'own-personal',
        }),
      )
      const rendered = render(
        <MemoryRouter
          initialEntries={[
            '/dashboard?tab=overview&challenge=' + requested + '#goals',
          ]}
        >
          <PersonalDashboardWorkspace workspace={workspace} />
        </MemoryRouter>,
      )
      expect(
        screen.getByText(/This personal goal is unavailable/),
      ).toBeInTheDocument()
      expect(screen.queryByText(/your goal$/)).not.toBeInTheDocument()
      expect(
        rendered.container.querySelector('[data-chart-reference]'),
      ).toBeNull()
      expect(
        screen.queryByRole('table', { name: 'Your saved personal weigh-ins' }),
      ).not.toBeInTheDocument()
    },
  )
  it('does not display another owner personal goal or a withdrawn enrollment', () => {
    const { workspace } = fixture()
    workspace.contexts.data.challenges[0].ownerId = 'other'
    const rendered = render(view(workspace))
    expect(screen.getByText(/No personal goal yet/)).toBeInTheDocument()
    workspace.contexts.data.challenges[0].ownerId = workspace.userId
    workspace.contexts.data.participants[0].status = 'withdrawn'
    rendered.rerender(view(workspace))
    expect(screen.getByText(/No personal goal yet/)).toBeInTheDocument()
  })
  it('validates the own starting-weight correction and refreshes after confirmed save', async () => {
    const { workspace, correct } = fixture()
    correct.mockResolvedValue({
      state: 'success',
      data: {
        challengeId: 'challenge-1',
        startingWeightKg: 90,
        targetWeightKg: 90,
      },
    })
    if (workspace.persistence.mode === 'local')
      workspace.persistence.mode = 'remote'
    render(view(workspace))
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    )
    const input = screen.getByLabelText('Correct starting weight (kg)')
    fireEvent.change(input, { target: { value: '89.99' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save starting weight' }),
    )
    expect(correct).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'at least your current target',
    )
    fireEvent.change(input, { target: { value: '90.001' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save starting weight' }),
    )
    expect(correct).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save starting weight' }),
    )
    await waitFor(() => expect(workspace.refresh).toHaveBeenCalledOnce())
    expect(correct).toHaveBeenCalledWith('challenge-1', 90)
    expect(workspace.contexts.data.participants[0].startingWeightKg).toBe(100)
    expect(workspace.contexts.data.participants[0].targetWeightKg).toBe(90)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('keeps the correction dialog and saved baseline unchanged on RPC failure', async () => {
    const { workspace, correct } = fixture()
    if (workspace.persistence.mode === 'local')
      workspace.persistence.mode = 'remote'
    correct.mockResolvedValue({
      state: 'error',
      error: { message: 'RPC unavailable' },
    })
    render(view(workspace))
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    )
    fireEvent.change(screen.getByLabelText('Correct starting weight (kg)'), {
      target: { value: '110' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save starting weight' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be confirmed',
    )
    expect(workspace.refresh).not.toHaveBeenCalled()
    expect(workspace.contexts.data.participants[0].startingWeightKg).toBe(100)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('offers the same caller-scoped correction for an owner-private personal enrollment', async () => {
    const { workspace, correct } = fixture('personal')
    if (workspace.persistence.mode === 'local')
      workspace.persistence.mode = 'remote'
    render(view(workspace))
    expect(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    )
    fireEvent.change(screen.getByLabelText('Correct starting weight (kg)'), {
      target: { value: '110' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Save starting weight' }),
    )
    await waitFor(() => expect(workspace.refresh).toHaveBeenCalledOnce())
    expect(correct).toHaveBeenCalledWith('challenge-1', 110)
    expect(workspace.contexts.data.participants[0].targetWeightKg).toBe(90)
  })
})

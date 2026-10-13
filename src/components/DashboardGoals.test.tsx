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

function fixture(kind: 'group' | 'personal' = 'group') {
  const challenge = createChallengeFixture({ kind, status: 'active' })
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
  const workspace: PersonalWorkspace = {
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
  }
  return { workspace, change, correct }
}
function view(workspace: PersonalWorkspace) {
  return (
    <MemoryRouter>
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

describe('integrated own Goals', () => {
  it('shows own group evidence and reached history without private notes or peer actions', async () => {
    const { workspace } = fixture()
    render(view(workspace))
    expect(screen.getByText('4.8 kg')).toBeInTheDocument()
    expect(
      screen.queryByText('Private note stays outside Goals'),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Change target' }),
    ).toHaveLength(1)
    expect(await screen.findByText('95 kg · 2026-10-02')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /shared history/ }),
    ).toHaveAttribute('href', '/group?challenge=challenge-1#group-history')
  })
  it('validates bounds and precision, saves through the own RPC and refreshes on confirmed success', async () => {
    const { workspace, change } = fixture()
    render(view(workspace))
    fireEvent.click(screen.getByRole('button', { name: 'Change target' }))
    const input = screen.getByLabelText('New target (kg)')
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '0.00000000001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '85.123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    expect(change).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '85' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    await waitFor(() => expect(workspace.refresh).toHaveBeenCalledOnce())
    expect(change).toHaveBeenCalledWith('challenge-1', 85)
    expect(workspace.contexts.data.participants[0].startingWeightKg).toBe(100)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('preserves the old target and editor input on server failure', async () => {
    const { workspace, change } = fixture()
    change.mockResolvedValue({
      state: 'error',
      error: { message: 'RPC absent' },
    })
    render(view(workspace))
    fireEvent.click(screen.getByRole('button', { name: 'Change target' }))
    fireEvent.change(screen.getByLabelText('New target (kg)'), {
      target: { value: '85' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be confirmed',
    )
    expect(workspace.refresh).not.toHaveBeenCalled()
    expect(workspace.contexts.data.participants[0].targetWeightKg).toBe(90)
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
  it('prevents duplicate correction submissions and ignores a result after the account changes', async () => {
    const { workspace, correct } = fixture()
    if (workspace.persistence.mode === 'local')
      workspace.persistence.mode = 'remote'
    let resolve!: (value: unknown) => void
    correct.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const rendered = render(view(workspace))
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit starting weight' }),
    )
    fireEvent.change(screen.getByLabelText('Correct starting weight (kg)'), {
      target: { value: '110' },
    })
    const form = screen
      .getByRole('button', { name: 'Save starting weight' })
      .closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(correct).toHaveBeenCalledOnce()
    rendered.rerender(
      view({
        ...workspace,
        ownerKey: 'second',
        userId: 'second',
        contexts: {
          ...workspace.contexts,
          key: 'second',
          data: { challenges: [], participants: [] },
        },
      }),
    )
    resolve({
      state: 'success',
      data: {
        challengeId: 'challenge-1',
        startingWeightKg: 110,
        targetWeightKg: 90,
      },
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(workspace.refresh).not.toHaveBeenCalled()
    expect(workspace.contexts.data.participants[0].startingWeightKg).toBe(100)
  })
  it('blocks duplicate submissions and drops a pending result when the account changes', async () => {
    const { workspace, change } = fixture()
    let resolve!: (value: unknown) => void
    change.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const rendered = render(view(workspace))
    fireEvent.click(screen.getByRole('button', { name: 'Change target' }))
    fireEvent.change(screen.getByLabelText('New target (kg)'), {
      target: { value: '85' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save target' }).closest('form')!,
    )
    fireEvent.submit(
      screen.getByRole('button', { name: 'Saving target…' }).closest('form')!,
    )
    expect(change).toHaveBeenCalledOnce()
    rendered.rerender(
      view({
        ...workspace,
        ownerKey: 'second',
        userId: 'second',
        contexts: {
          ...workspace.contexts,
          data: { challenges: [], participants: [] },
        },
      }),
    )
    resolve({
      state: 'success',
      data: {
        challengeId: 'challenge-1',
        startingWeightKg: 100,
        targetWeightKg: 85,
      },
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(workspace.refresh).not.toHaveBeenCalled()
    expect(screen.queryByText(/your goal$/)).not.toBeInTheDocument()
  })
  it('requires a lower target after a previous qualifying achievement', () => {
    const { workspace, change } = fixture()
    workspace.personal.data.unshift({
      id: 'reached',
      date: '2026-10-02',
      weightKg: 89,
      sharedChallengeIds: ['challenge-1'],
    })
    render(view(workspace))
    fireEvent.click(
      screen.getByRole('button', { name: /Target reached · Change target/ }),
    )
    fireEvent.change(screen.getByLabelText('New target (kg)'), {
      target: { value: '91' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save target' }))
    expect(screen.getByRole('alert')).toHaveTextContent('choose a lower target')
    expect(change).not.toHaveBeenCalled()
  })
})

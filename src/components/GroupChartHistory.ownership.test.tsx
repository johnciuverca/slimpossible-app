import { createHash } from 'node:crypto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import type { Persistence } from '../data/persistence'
import { GroupChartHistory } from './GroupChartHistory'

const state = vi.hoisted(() => ({ workspace: {} as PersonalWorkspace }))
vi.mock('../data/usePersonalWorkspace', () => ({
  usePersonalWorkspace: () => state.workspace,
}))
const group = '11111111-1111-4111-8111-111111111111'
const viewer = '33333333-3333-4333-8333-333333333333'
const other = '44444444-4444-4444-8444-444444444444'
const key = (user: string) =>
  createHash('md5').update(`${group}:${user}`).digest('hex')
const persistence = {
  mode: 'remote',
  repositories: {
    groupProgress: {
      getChartHistory: async () => ({
        state: 'success',
        data: [viewer, other].map((user) => ({
          memberKey: key(user),
          displayName: 'Same name',
          date: '2026-09-22',
          weightKg: 88.5,
        })),
      }),
    },
  },
} as unknown as Persistence
const view = (viewerId = viewer) => (
  <GroupChartHistory
    challengeId={group}
    viewerId={viewerId}
    persistence={persistence}
    refreshVersion={0}
  />
)
beforeEach(() => {
  state.workspace = {
    userId: viewer,
    ownerKey: `signed-in:${viewer}`,
    persistence,
    personal: {
      state: 'ready',
      data: [
        {
          id: 'own',
          date: '2026-09-22',
          weightKg: 88.5,
          note: 'private',
          sharedChallengeIds: [group],
        },
      ],
      error: '',
    },
    contexts: {
      state: 'ready',
      data: { challenges: [], participants: [] },
      error: '',
    },
    refresh: vi.fn(),
  } as unknown as PersonalWorkspace
})
afterEach(cleanup)
describe('Group matrix ownership', () => {
  it('uses opaque identity even with duplicate names and identical dates and weights', async () => {
    render(view())
    const table = await screen.findByRole('table')
    const ownOrdinal = key(viewer) < key(other) ? 1 : 2
    expect(within(table).getAllByRole('button')).toHaveLength(2)
    expect(
      within(table).getByRole('button', {
        name: `Edit weight 2026-09-22 for Same name (member ${ownOrdinal})`,
      }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('tab', { name: `Same name (member ${3 - ownOrdinal})` }),
    )
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
    fireEvent.click(
      screen.getByRole('tab', { name: `Same name (member ${ownOrdinal})` }),
    )
    expect(within(table).getAllByRole('button')).toHaveLength(2)
    expect(table).not.toHaveTextContent('private')
  })
  it.each([
    'unshared',
    'personal-loading',
    'context-error',
    'different-owner',
    'local',
  ])('fails closed for %s workspace', async (condition) => {
    if (condition === 'unshared')
      state.workspace.personal.data[0].sharedChallengeIds = ['another-group']
    if (condition === 'personal-loading')
      state.workspace.personal.state = 'loading'
    if (condition === 'context-error') state.workspace.contexts.state = 'error'
    if (condition === 'different-owner') state.workspace.userId = other
    if (condition === 'local')
      state.workspace.persistence = { mode: 'local' } as Persistence
    render(view())
    const table = await screen.findByRole('table')
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })
  it('hides actions immediately on viewer change and never remaps identical values', async () => {
    const { rerender } = render(view())
    await screen.findByRole('button', { name: /^Edit weight/ })
    rerender(view(other))
    expect(
      screen.queryByRole('button', { name: /^Edit weight/ }),
    ).not.toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })
})

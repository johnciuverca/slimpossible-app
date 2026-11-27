import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecordWeightDialog } from './RecordWeightDialog'
import { createPersistence } from '../data/persistence'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { createChallengeFixture } from '../models/fixtures'

const group = createChallengeFixture({ id: 'eligible', name: 'Eligible group' })
function workspace(
  state: 'loading' | 'ready',
  groups = [group],
): PersonalWorkspace {
  return {
    ownerKey: 'synthetic-author',
    userId: 'user-alex',
    persistence: createPersistence({
      status: 'signed-out',
      user: null,
      error: null,
    }),
    personal: { key: '', state: 'ready', data: [], error: '' },
    contexts: {
      key: '',
      state,
      data: { challenges: groups, participants: [] },
      error: '',
    },
    groups: state === 'ready' ? groups : [],
    refresh: vi.fn(),
  }
}
afterEach(cleanup)

it('defaults on the first ready group snapshot once and preserves opt-out across reloads', () => {
  const props = { onClose: vi.fn(), onSaved: vi.fn() }
  const { rerender } = render(
    <RecordWeightDialog {...props} workspace={workspace('loading')} />,
  )
  expect(screen.queryByRole('checkbox')).toBeNull()
  rerender(<RecordWeightDialog {...props} workspace={workspace('ready')} />)
  expect(screen.getByRole('checkbox')).toBeChecked()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.change(screen.getByLabelText('Weight in kg'), {
    target: { value: '82' },
  })
  rerender(<RecordWeightDialog {...props} workspace={workspace('loading')} />)
  rerender(<RecordWeightDialog {...props} workspace={workspace('ready')} />)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  rerender(
    <RecordWeightDialog
      {...props}
      workspace={workspace('ready', [
        createChallengeFixture({
          id: 'replacement',
          name: 'Replacement group',
        }),
      ])}
    />,
  )
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

it('does not default a private edit when its group choices arrive later', () => {
  const entry = {
    id: 'private',
    date: '2026-11-20',
    weightKg: 82,
    sharedChallengeIds: [],
  }
  const props = { entry, onClose: vi.fn(), onSaved: vi.fn() }
  const { rerender } = render(
    <RecordWeightDialog {...props} workspace={workspace('loading')} />,
  )
  rerender(<RecordWeightDialog {...props} workspace={workspace('ready')} />)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

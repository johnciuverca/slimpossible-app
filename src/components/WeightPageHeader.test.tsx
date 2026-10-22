import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecordWeightAction } from './WeightPageHeader'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
vi.mock('./RecordWeightDialog', () => ({
  RecordWeightDialog: ({ onSaved }: { onSaved: () => void }) => (
    <button onClick={onSaved}>Synthetic successful save</button>
  ),
}))
afterEach(cleanup)
it('notifies the Group caller only after a successful canonical save and refreshes personal history', () => {
  const refresh = vi.fn()
  const recorded = vi.fn()
  const workspace = {
    ownerKey: 'synthetic-owner',
    personal: { state: 'ready', data: [] },
    refresh,
  } as unknown as PersonalWorkspace
  render(<RecordWeightAction workspace={workspace} onRecorded={recorded} />)
  fireEvent.click(screen.getByRole('button', { name: 'Record weight' }))
  expect(recorded).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Synthetic successful save' }),
  )
  expect(recorded).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledTimes(1)
})

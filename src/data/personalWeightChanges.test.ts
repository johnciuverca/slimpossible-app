import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import {
  notifyPersonalWeightChange,
  usePersonalWeightRevision,
} from './personalWeightChanges'

afterEach(cleanup)
it('refreshes all mounted consumers for the author, never other accounts', () => {
  const first = renderHook(() => usePersonalWeightRevision('author'))
  const group = renderHook(() => usePersonalWeightRevision('author'))
  const other = renderHook(() => usePersonalWeightRevision('other'))
  act(() => notifyPersonalWeightChange('author'))
  expect(first.result.current).toBe(1)
  expect(group.result.current).toBe(1)
  expect(other.result.current).toBe(0)
})
it('stops listening to the previous account after a switch', () => {
  const view = renderHook(({ userId }) => usePersonalWeightRevision(userId), {
    initialProps: { userId: 'old' },
  })
  view.rerender({ userId: 'new' })
  act(() => notifyPersonalWeightChange('old'))
  expect(view.result.current).toBe(0)
  act(() => notifyPersonalWeightChange('new'))
  expect(view.result.current).toBe(1)
})

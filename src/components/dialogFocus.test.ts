import { afterEach, expect, it, vi } from 'vitest'
import { focusAfterWeightMutation } from './dialogFocus'

afterEach(() => {
  document.body.replaceChildren()
  vi.clearAllTimers()
  vi.useRealTimers()
})
function fixture() {
  const main = document.createElement('main')
  const header = document.createElement('header')
  header.setAttribute('data-weight-page-header', '')
  const action = document.createElement('button')
  action.dataset.weightOwner = 'author'
  action.disabled = true
  const trigger = document.createElement('button')
  header.append(action)
  main.append(header, trigger)
  document.body.append(main)
  return { action, trigger }
}
it('waits for refresh before returning focus to the stable weight action', async () => {
  vi.useFakeTimers()
  const { action, trigger } = fixture()
  focusAfterWeightMutation(trigger, () => trigger.remove())
  vi.advanceTimersByTime(0)
  expect(document.activeElement).not.toBe(action)
  action.disabled = false
  await Promise.resolve()
  expect(document.activeElement).toBe(action)
})
it('does not return focus to an action belonging to a different account', async () => {
  vi.useFakeTimers()
  const { action, trigger } = fixture()
  focusAfterWeightMutation(trigger)
  vi.advanceTimersByTime(0)
  action.dataset.weightOwner = 'different-author'
  action.disabled = false
  await Promise.resolve()
  expect(document.activeElement).not.toBe(action)
})
it('restores focus again when refresh starts after the first enabled render', async () => {
  vi.useFakeTimers()
  const { action, trigger } = fixture()
  action.disabled = false
  focusAfterWeightMutation(trigger)
  vi.advanceTimersByTime(0)
  action.disabled = true
  await Promise.resolve()
  trigger.focus()
  action.disabled = false
  await Promise.resolve()
  expect(document.activeElement).toBe(action)
})

it.each([false, true])(
  'finds the Group subnav action outside main and respects account changes (%s)',
  async (switchAccount) => {
    vi.useFakeTimers()
    const shell = document.createElement('div')
    shell.className = 'app-shell'
    const subnav = document.createElement('div')
    subnav.className = 'group-subnav-actions'
    const action = document.createElement('button')
    action.dataset.weightOwner = 'author'
    action.disabled = true
    const main = document.createElement('main')
    const trigger = document.createElement('button')
    main.append(trigger)
    subnav.append(action)
    shell.append(subnav, main)
    document.body.append(shell)
    focusAfterWeightMutation(trigger, () => trigger.remove())
    vi.advanceTimersByTime(0)
    if (switchAccount) action.dataset.weightOwner = 'another-account'
    action.disabled = false
    await Promise.resolve()
    if (switchAccount) expect(document.activeElement).not.toBe(action)
    else expect(document.activeElement).toBe(action)
  },
)

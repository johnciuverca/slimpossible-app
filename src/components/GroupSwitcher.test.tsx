import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { createChallengeFixture } from '../models/fixtures'
import { GroupSwitcher } from './GroupSwitcher'

afterEach(cleanup)
const groups = [
  createChallengeFixture({ id: 'first', name: 'First group' }),
  createChallengeFixture({ id: 'second', name: 'Second group' }),
  createChallengeFixture({
    id: 'private-personal',
    kind: 'personal',
    name: 'Personal',
  }),
  createChallengeFixture({
    id: 'archived',
    status: 'archived',
    name: 'Archived',
  }),
]
function Route() {
  const l = useLocation()
  return (
    <output data-testid="route">
      {l.pathname}
      {l.search}
    </output>
  )
}
function setup(path: string, loading = false, error = '') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GroupSwitcher challenges={groups} loading={loading} error={error} />
      <Route />
    </MemoryRouter>,
  )
}
it('switches authorized groups while retaining the Group tab and safe URL state', () => {
  setup('/group?challenge=first&tab=records&source=invite')
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose group: First group' }),
  )
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    'First group',
    'Second group',
  ])
  expect(screen.queryByRole('link', { name: 'Group overview' })).toBeNull()
  expect(
    screen.queryByRole('link', { name: 'Personal' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Archived' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Second group' }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=second&tab=records&source=invite',
  )
  expect(
    screen.getByRole('button', { name: 'Choose group: Second group' }),
  ).toHaveAttribute('aria-expanded', 'false')
})
it('opens Overview from Dashboard without inheriting personal selection', () => {
  setup('/dashboard?challenge=personal&tab=weigh-ins')
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  fireEvent.click(screen.getByRole('link', { name: 'Second group' }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=second&tab=overview',
  )
})
it('closes on Escape and outside pointer interaction', () => {
  setup('/group')
  const button = screen.getByRole('button', {
    name: 'Choose group: First group',
  })
  fireEvent.click(button)
  fireEvent.keyDown(button, { key: 'Escape' })
  expect(button).toHaveFocus()
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  fireEvent.pointerDown(document.body)
  expect(button).toHaveAttribute('aria-expanded', 'false')
})
it.each([
  [true, ''],
  [false, 'Unable to load groups.'],
])('retains direct Group access during loading or error', (loading, error) => {
  setup('/dashboard', loading, error)
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  expect(screen.getByRole('link', { name: 'Group overview' })).toHaveAttribute(
    'href',
    '/group',
  )
  expect(
    screen.getByText(loading ? 'Loading authorized groups…' : error),
  ).toBeVisible()
})

it('keeps empty and single-group navigation usable without an unavailable selection', () => {
  const view = render(
    <MemoryRouter initialEntries={['/group?challenge=not-authorized']}>
      <GroupSwitcher challenges={[]} loading={false} error="" />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  expect(screen.getByText('No active groups available.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Group overview' })).toBeVisible()
  view.unmount()
  render(
    <MemoryRouter initialEntries={['/group']}>
      <GroupSwitcher challenges={[groups[0]]} loading={false} error="" />
    </MemoryRouter>,
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose group: First group' }),
  )
  expect(screen.getByRole('link', { name: 'First group' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.queryByRole('link', { name: 'Group overview' })).toBeNull()
})

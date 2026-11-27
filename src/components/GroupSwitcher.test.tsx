import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { createChallengeFixture } from '../models/fixtures'
import { GroupSwitcher } from './GroupSwitcher'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
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
    <>
      <output data-testid="route">
        {l.pathname}
        {l.search}
      </output>
      <Link to="/dashboard?tab=overview">Dashboard Overview</Link>
    </>
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
it('navigates from the group name while the arrow independently opens the menu', () => {
  setup('/group?challenge=first&tab=records')
  fireEvent.click(screen.getByRole('link', { name: 'Open group: First group' }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=first&tab=records',
  )
  const arrow = screen.getByRole('button', {
    name: 'Choose group: First group',
  })
  fireEvent.click(arrow)
  expect(arrow).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Second group' })).toBeVisible()
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=first&tab=records',
  )
})

it('keeps current Group section when clicking group name and arrow only toggles menu', () => {
  setup('/group?challenge=first&tab=records&source=invite')
  fireEvent.click(screen.getByRole('link', { name: 'Open group: First group' }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=first&tab=records',
  )
  const arrow = screen.getByRole('button', {
    name: 'Choose group: First group',
  })
  fireEvent.click(arrow)
  expect(arrow).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=first&tab=records',
  )
})

it('retains an authorized group on Dashboard and returns to that group from its name', () => {
  window.localStorage.clear()
  setup('/group?challenge=first&tab=records')
  fireEvent.click(screen.getByRole('link', { name: 'Dashboard Overview' }))
  expect(
    screen.getByRole('link', { name: 'Open group: First group' }),
  ).toHaveAttribute('href', '/group?challenge=first&tab=overview')
  fireEvent.click(screen.getByRole('link', { name: 'Open group: First group' }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/group?challenge=first&tab=overview',
  )
})
it('switches authorized groups while retaining the Group tab and safe URL state', () => {
  setup('/group?challenge=first&tab=records&source=invite')
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose group: First group' }),
  )
  expect(
    screen
      .getAllByRole('link')
      .filter((link) => link.closest('.group-switcher-panel'))
      .map((link) => link.textContent),
  ).toEqual(['First group', 'Second group'])
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
  expect(
    screen
      .getAllByRole('link')
      .filter((link) => link.closest('.group-switcher-panel')),
  ).toHaveLength(1)
  expect(screen.queryByRole('link', { name: 'Group overview' })).toBeNull()
})

it('shows one owner-authorized Manage groups action after the group list', () => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <GroupSwitcher
        challenges={groups}
        loading={false}
        error=""
        canManageGroups
      />
      <Route />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  const links = screen
    .getAllByRole('link')
    .filter((link) => link.closest('.group-switcher-panel'))
  expect(links.map((link) => link.textContent)).toEqual([
    'First group',
    'Second group',
    'Manage groups',
  ])
  expect(screen.getByRole('link', { name: 'Manage groups' })).toHaveAttribute(
    'href',
    '/challenge/manage',
  )
  expect(
    screen.getByRole('link', { name: 'Manage groups' }).previousElementSibling,
  ).toHaveAttribute('class', 'group-switcher-divider')
})

it('hides Manage groups for viewers without a manageable group', () => {
  setup('/dashboard')
  fireEvent.click(screen.getByRole('button', { name: 'Choose group' }))
  expect(
    screen.queryByRole('link', { name: 'Manage groups' }),
  ).not.toBeInTheDocument()
})

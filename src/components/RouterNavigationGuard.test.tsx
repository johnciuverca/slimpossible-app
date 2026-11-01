import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  createMemoryRouter,
  Link,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { AuthProvider } from '../auth/AuthContext'
import { useUnsavedNavigation } from './navigationSafety'
import { DashboardChallengeActions } from './DashboardChallengeActions'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'

const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
)
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
)
beforeEach(() => {
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
  if (originalShow)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShow,
    )
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose)
})
function Editor() {
  const [value, setValue] = useState('')
  const location = useLocation()
  useUnsavedNavigation(value ? 'dirty' : null)
  return (
    <>
      <output data-testid="route">
        {location.pathname}
        {location.search}
      </output>
      <input
        aria-label="Unsaved weight"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Link to="/weigh-ins?challenge=second">Change recording context</Link>
      <Link to="/dashboard">Leave editor</Link>
    </>
  )
}

it('guards contextual section switches and Back while keeping the weigh-in draft on Stay', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppLayout>
            <Editor />
          </AppLayout>
        ),
      },
    ],
    {
      initialEntries: ['/dashboard', '/weigh-ins?challenge=group-one'],
      initialIndex: 1,
    },
  )
  render(
    <AuthProvider
      initialState={{
        status: 'signed-in',
        error: null,
        user: { id: 'owner-1', email: 'owner@example.invalid' },
      }}
    >
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  fireEvent.change(screen.getByLabelText('Unsaved weight'), {
    target: { value: '83.2' },
  })
  fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
  expect(
    await screen.findByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
  expect(screen.getByLabelText('Unsaved weight')).toHaveValue('83.2')
  expect(router.state.location.pathname).toBe('/weigh-ins')
  await act(async () => {
    await router.navigate(-1)
  })
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Discard and leave' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  router.dispose()
})

function groupActionsRouter() {
  const workspace = {
    ownerKey: 'signed-in:owner-1',
    userId: 'owner-1',
    contexts: { state: 'ready', data: { challenges: [], participants: [] } },
  } as unknown as PersonalWorkspace
  const router = createMemoryRouter(
    [
      {
        element: (
          <AppLayout>
            <Outlet />
          </AppLayout>
        ),
        children: [
          {
            path: '/group',
            element: (
              <DashboardChallengeActions workspace={workspace} protectDraft />
            ),
          },
          { path: '/challenge/setup', element: <h1>Create destination</h1> },
          { path: '/invite/:token', element: <h1>Review destination</h1> },
        ],
      },
    ],
    { initialEntries: ['/group'] },
  )
  render(
    <AuthProvider
      initialState={{
        status: 'signed-in',
        error: null,
        user: { id: 'owner-1', email: 'owner@example.invalid' },
      }}
    >
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Join with invitation' }))
  fireEvent.change(screen.getByLabelText('Invitation link or token'), {
    target: { value: 'saved-draft' },
  })
  return router
}

it('guards a Group join draft across navigation with Stay and explicit Discard', async () => {
  const router = groupActionsRouter()
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  fireEvent.click(screen.getByRole('link', { name: 'Create challenge' }))
  expect(
    await screen.findByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
  expect(screen.getByLabelText('Invitation link or token')).toHaveValue(
    'saved-draft',
  )
  fireEvent.click(screen.getByRole('link', { name: 'Create challenge' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Discard and leave' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Create destination' }),
  ).toBeInTheDocument()
  router.dispose()
})

it('allows intentional invitation review without a discard prompt', async () => {
  const router = groupActionsRouter()
  fireEvent.click(screen.getByRole('button', { name: 'Review invitation' }))
  expect(
    await screen.findByRole('heading', { name: 'Review destination' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/invite/saved-draft')
  router.dispose()
})
it('guards a signed-in logo departure before opening the canonical Dashboard', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppLayout>
            <Editor />
          </AppLayout>
        ),
      },
    ],
    { initialEntries: ['/weigh-ins?challenge=private-plan'] },
  )
  render(
    <AuthProvider
      initialState={{
        status: 'signed-in',
        error: null,
        user: { id: 'owner-1', email: 'owner@example.invalid' },
      }}
    >
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  fireEvent.change(screen.getByLabelText('Unsaved weight'), {
    target: { value: '83.2' },
  })
  const logo = screen.getByRole('link', { name: 'Slimpossible' })
  fireEvent.click(logo)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Stay$/ }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/weigh-ins?challenge=private-plan',
  )
  expect(screen.getByLabelText('Unsaved weight')).toHaveValue('83.2')
  fireEvent.click(logo)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Discard and leave' }),
  )
  await waitFor(() =>
    expect(screen.getByTestId('route').textContent).toBe('/dashboard'),
  )
  router.dispose()
})
it('retains the weigh-in draft across context-only navigation, while guarding departure with Stay/Discard', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <AppLayout>
            <Editor />
          </AppLayout>
        ),
      },
    ],
    { initialEntries: ['/weigh-ins'] },
  )
  render(
    <AuthProvider
      initialState={{ status: 'signed-out', user: null, error: null }}
    >
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  fireEvent.change(screen.getByLabelText('Unsaved weight'), {
    target: { value: '83.2' },
  })
  fireEvent.click(
    screen.getByRole('link', { name: 'Change recording context' }),
  )
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent(
      '/weigh-ins?challenge=second',
    ),
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Unsaved weight')).toHaveValue('83.2')
  fireEvent.click(screen.getByRole('link', { name: 'Leave editor' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Stay$/ }))
  expect(screen.getByTestId('route')).toHaveTextContent(
    '/weigh-ins?challenge=second',
  )
  fireEvent.click(screen.getByRole('link', { name: 'Leave editor' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Discard and leave' }),
  )
  await waitFor(() =>
    expect(screen.getByTestId('route')).toHaveTextContent('/dashboard'),
  )
  router.dispose()
})

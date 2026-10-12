import { useState } from 'react'
import {
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
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import { AppLayout } from '../layout/AppLayout'
import { AuthProvider } from '../auth/AuthContext'
import { useUnsavedNavigation } from './navigationSafety'

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

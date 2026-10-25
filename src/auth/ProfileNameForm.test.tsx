import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './AuthContext'
import { AuthSessionUI } from './AuthSessionUI'
import type { AuthGateway, AuthUser } from './context'

const alex = { id: 'alex', email: 'alex@example.invalid', displayName: 'Alex' }
const ben = { id: 'ben', email: 'ben@example.invalid', displayName: 'Ben' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    requestEmailChange: async () => undefined,
    ensureProfile: async (user) => user.displayName,
    getSession: async () => alex,
    onAuthStateChange: () => () => undefined,
    requestPasswordRecovery: async () => undefined,
    resetPassword: async () => undefined,
    signIn: async () => alex,
    signOut: async () => undefined,
    signUp: async () => ({ user: null, needsVerification: true }),
    saveProfileName: async (_user, name) => name,
    ...overrides,
  }
}

function session(authGateway: AuthGateway) {
  return render(
    <MemoryRouter>
      <AuthProvider authGateway={authGateway}>
        <AuthSessionUI />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function openProfile(name = 'Alex', edit = true) {
  await screen.findByText(name)
  fireEvent.click(screen.getByText(name))
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
  expect(
    screen.queryByRole('textbox', { name: 'Username' }),
  ).not.toBeInTheDocument()
  if (edit)
    fireEvent.click(screen.getByRole('button', { name: 'Edit username' }))
}

function submit(name: string) {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: name },
  })
  fireEvent.submit(screen.getByRole('form', { name: 'Edit username' }))
}

describe('Profile username editing', () => {
  afterEach(cleanup)

  it('saves a trimmed nickname, updates the account control, and restores it on reload', async () => {
    let stored = 'Alex'
    let emit!: (user: AuthUser | null) => void
    const request = deferred<string>()
    const save = vi.fn(async (_user: AuthUser, name: string) => {
      stored = await request.promise
      return name
    })
    const auth = gateway({
      onAuthStateChange: (callback) => {
        emit = callback
        return () => undefined
      },
      ensureProfile: async () => stored,
      saveProfileName: save,
    })
    const first = session(auth)
    await openProfile()
    expect(screen.getByLabelText('Username')).toHaveFocus()
    submit('  Nickname  ')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByLabelText('Username')).toBeDisabled()
    expect(screen.getByText('Saving your username…')).toHaveAttribute(
      'role',
      'status',
    )
    await act(async () => request.resolve('Nickname'))
    expect(await screen.findByText('Username saved.')).toHaveAttribute(
      'role',
      'status',
    )
    expect(
      screen.queryByRole('textbox', { name: 'Username' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit username' })).toHaveFocus()
    expect(screen.getAllByText('Nickname')).toHaveLength(2)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alex' }),
      'Nickname',
    )
    await act(async () => emit(alex))
    expect(screen.getAllByText('Nickname')).toHaveLength(2)
    first.unmount()
    session(auth)
    expect(await screen.findByText('Nickname')).toBeInTheDocument()
  })

  it('validates blank/long names and preserves the old name and draft after failure, allowing retry', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValueOnce('Retry nickname')
    session(gateway({ saveProfileName: save }))
    await openProfile()
    submit('   ')
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(
      'Enter your username or nickname.',
    )
    submit('x'.repeat(81))
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription(
      'Use 80 characters or fewer for your username.',
    )
    expect(save).not.toHaveBeenCalled()
    submit('Retry nickname')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your username. Try again.',
    )
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveValue('Retry nickname')
    fireEvent.submit(screen.getByRole('form', { name: 'Edit username' }))
    expect(await screen.findByText('Username saved.')).toBeInTheDocument()
    expect(screen.getAllByText('Retry nickname')).toHaveLength(2)
  })

  it('discards a stale save after switching away and back to the same account', async () => {
    const request = deferred<string>()
    let emit!: (user: AuthUser | null) => void
    session(
      gateway({
        onAuthStateChange: (callback) => {
          emit = callback
          return () => undefined
        },
        saveProfileName: () => request.promise,
      }),
    )
    await openProfile()
    submit('Stale nickname')
    await act(async () => emit(ben))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Ben')).toBeInTheDocument()
    await act(async () => emit(alex))
    await screen.findByText('Alex')
    await act(async () => request.resolve('Stale nickname'))
    expect(screen.queryByText('Stale nickname')).not.toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.queryByText('Username saved.')).not.toBeInTheDocument()
  })

  it('does not let an older initialization read overwrite a completed save', async () => {
    const request = deferred<string | undefined>()
    const ensureProfile = vi.fn(() => request.promise)
    session(gateway({ ensureProfile }))
    await openProfile()
    await waitFor(() => expect(ensureProfile).toHaveBeenCalledTimes(1))
    submit('New nickname')
    await screen.findByText('Username saved.')
    await act(async () => request.resolve('Old database name'))
    expect(screen.getAllByText('New nickname')).toHaveLength(2)
    expect(screen.queryByText('Old database name')).not.toBeInTheDocument()
  })

  it('lets an unnamed account set its first username without editing the fallback label', async () => {
    const save = vi.fn(async (_user: AuthUser, name: string) => name)
    session(
      gateway({
        getSession: async () => ({ id: 'alex', email: alex.email }),
        ensureProfile: async () => undefined,
        saveProfileName: save,
      }),
    )
    await openProfile('Your account')
    expect(screen.getByLabelText('Username')).toHaveValue('')
    submit('First nickname')
    await screen.findByText('Username saved.')
    expect(screen.getAllByText('First nickname')).toHaveLength(2)
  })

  it('starts read-only and Cancel restores the saved value without writing', async () => {
    const save = vi.fn(async (_user: AuthUser, name: string) => name)
    session(gateway({ saveProfileName: save }))
    await openProfile('Alex', false)
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument()
    fireEvent.submit(screen.getByRole('form', { name: 'Edit username' }))
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit username' }))
    expect(screen.getByLabelText('Username')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'Unsaved nickname' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByText('Alex')).toHaveLength(2)
    expect(
      screen.queryByRole('textbox', { name: 'Username' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit username' })).toHaveFocus()
    expect(save).not.toHaveBeenCalled()
  })
})

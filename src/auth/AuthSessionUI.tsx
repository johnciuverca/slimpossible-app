import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

import { Button, FeedbackPanel } from '../components/ui'
import { useAuth } from './useAuth'
import { trapDialogFocus } from '../components/dialogFocus'

export function AuthSessionUI() {
  const { retrySession, signOut, state } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (state.status === 'loading') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="flex items-center gap-2 text-xs text-ink-muted"
      >
        <span className="rounded-full border border-forest-700/25 bg-forest-50 px-2 py-0.5 font-bold uppercase tracking-wide text-forest-800">
          Loading
        </span>
        <span>Checking session…</span>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <FeedbackPanel className="p-2" tone="error">
          {state.error}
        </FeedbackPanel>
        <Button onClick={retrySession} variant="secondary">
          Retry
        </Button>
      </div>
    )
  }

  if (state.status === 'signed-in') {
    return (
      <AccountControl
        key={`${state.user.id}:${state.user.email}`}
        name={state.user.displayName?.trim() || 'Your account'}
        email={state.user.email}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Link
      className="rounded-sm text-sm font-semibold text-forest-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
      to="/login"
    >
      Log in
    </Link>
  )
}

function AccountControl({
  name,
  email,
  onLogout,
}: {
  name: string
  email: string
  onLogout: () => Promise<void>
}) {
  const [profile, setProfile] = useState(false)
  const menu = useRef<HTMLDetailsElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!profile) return
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => element?.close()
  }, [profile])
  const close = () => {
    dialog.current?.close()
    setProfile(false)
    menu.current?.querySelector('summary')?.focus()
  }
  return (
    <>
      <details
        ref={menu}
        className="account-control relative"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            menu.current?.removeAttribute('open')
            menu.current?.querySelector('summary')?.focus()
          }
        }}
      >
        <summary
          aria-label={`Profile and account for ${name}`}
          title="Profile and account"
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-forest-700"
        >
          <span className="account-avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="account-name min-w-0 truncate">{name}</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="account-options absolute right-0 z-30 mt-2 w-44 rounded-xl border border-line bg-panel p-2 shadow-panel">
          <Button
            className="w-full justify-start"
            variant="ghost"
            onClick={() => {
              menu.current?.removeAttribute('open')
              setProfile(true)
            }}
          >
            Profile
          </Button>
          <Button
            className="w-full justify-start"
            onClick={onLogout}
            variant="ghost"
          >
            Log out
          </Button>
        </div>
      </details>
      {profile ? (
        <dialog
          ref={dialog}
          aria-labelledby="account-profile-title"
          className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-panel p-6 text-ink shadow-panel backdrop:bg-black/60"
          onKeyDown={trapDialogFocus}
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
        >
          <h2 id="account-profile-title" className="text-2xl font-bold">
            Profile
          </h2>
          <dl className="my-6 space-y-4">
            <div>
              <dt className="text-sm text-ink-muted">Name</dt>
              <dd className="break-words font-semibold">{name}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Email</dt>
              <dd className="break-all font-semibold">{email}</dd>
            </div>
          </dl>
          <Button onClick={close}>Close Profile</Button>
        </dialog>
      ) : null}
    </>
  )
}

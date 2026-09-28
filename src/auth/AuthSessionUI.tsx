import { Link, useNavigate } from 'react-router-dom'

import { Button, FeedbackPanel } from '../components/ui'
import { useAuth } from './useAuth'

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
      <div className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-sm text-ink-muted">
          Signed in as{' '}
          <span className="font-semibold text-ink">{state.user.email}</span>
        </p>
        <Button onClick={handleLogout} variant="ghost">
          Log out
        </Button>
      </div>
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

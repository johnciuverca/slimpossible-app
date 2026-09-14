import { Link } from 'react-router-dom'

import { Button } from '../components/ui'
import { useAuth } from './useAuth'

export function AuthSessionUI() {
  const { retrySession, signOut, state } = useAuth()

  if (state.status === 'loading') {
    return (
      <p aria-live="polite" className="text-sm text-slate-500">
        Checking session…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <div aria-live="polite" className="flex items-center gap-3">
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
        <Button onClick={retrySession} variant="secondary">
          Retry
        </Button>
      </div>
    )
  }

  if (state.status === 'signed-in') {
    return (
      <div className="flex items-center gap-3">
        <p aria-live="polite" className="text-sm text-slate-600">
          Signed in as <span className="font-semibold">{state.user.email}</span>
        </p>
        <Button onClick={signOut} variant="ghost">
          Log out
        </Button>
      </div>
    )
  }

  return (
    <Link
      className="text-sm font-semibold text-emerald-700 underline"
      to="/login"
    >
      Log in
    </Link>
  )
}

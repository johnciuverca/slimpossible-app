import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Button, Card, PageHeader } from '../components/ui'
import { useAuth } from './useAuth'

function SessionBoundaryMessage({
  children,
  error,
}: {
  children: string
  error?: boolean
}) {
  return (
    <section
      aria-labelledby="session-boundary-title"
      className="mx-auto flex w-full max-w-2xl flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader title="Authentication" titleId="session-boundary-title">
          <p
            className={error ? 'text-red-700' : 'text-slate-600'}
            role={error ? 'alert' : 'status'}
          >
            {children}
          </p>
        </PageHeader>
      </Card>
    </section>
  )
}

export function ProtectedRoute() {
  const location = useLocation()
  const { retrySession, state } = useAuth()

  if (state.status === 'loading') {
    return <SessionBoundaryMessage>Checking session…</SessionBoundaryMessage>
  }

  if (state.status === 'error') {
    return (
      <section
        aria-labelledby="session-error-title"
        className="mx-auto flex w-full max-w-2xl flex-1 items-center"
      >
        <Card className="w-full p-8 sm:p-10">
          <PageHeader title="Authentication" titleId="session-error-title">
            <p className="text-red-700" role="alert">
              {state.error}
            </p>
            <Button className="mt-6" onClick={retrySession} variant="secondary">
              Retry
            </Button>
          </PageHeader>
        </Card>
      </section>
    )
  }

  if (state.status !== 'signed-in') {
    return (
      <Navigate
        replace
        state={{
          from: {
            hash: location.hash,
            pathname: location.pathname,
            search: location.search,
          },
        }}
        to="/login"
      />
    )
  }

  return <Outlet />
}

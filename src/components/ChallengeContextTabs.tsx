import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'

function challengeTabDestination(path: string, challenge?: Challenge) {
  if (!challenge) {
    return ['/dashboard', '/today', '/', '/weigh-ins', '/progress'].includes(
      path,
    )
      ? path === '/today' || path === '/'
        ? '/dashboard'
        : path
      : '/dashboard'
  }
  const destination =
    ['/dashboard', '/today', '/'].includes(path) ||
    (path === '/group' && challenge.kind === 'personal')
      ? '/progress'
      : path
  return `${destination}?${new URLSearchParams({ challenge: challenge.id })}`
}

export function ChallengeTabs({
  challenges,
  selectedId,
  loading = false,
  error = '',
}: {
  challenges: Challenge[]
  selectedId?: string | null
  loading?: boolean
  error?: string
}) {
  const { pathname, search } = useLocation()
  const selected = ['/dashboard', '/today'].includes(pathname)
    ? null
    : (selectedId ??
      new URLSearchParams(search).get('challenge') ??
      (['/goals', '/challenges'].includes(pathname) ? challenges[0]?.id : null))
  const row = useRef<HTMLDivElement>(null)
  const personalPage = [
    '/dashboard',
    '/today',
    '/',
    '/progress',
    '/weigh-ins',
  ].includes(pathname)
  useEffect(() => {
    const element = row.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    )
    if (!element || !row.current) return
    // Horizontal movement only: loading/changing contexts must not jump page focus.
    const item = element.getBoundingClientRect()
    const container = row.current.getBoundingClientRect()
    if (item.left < container.left)
      row.current.scrollLeft -= container.left - item.left
    else if (item.right > container.right)
      row.current.scrollLeft += item.right - container.right
  }, [selected, challenges])
  return (
    <nav aria-label="Challenge contexts" className="min-w-0 space-y-2">
      <p className="text-xs font-semibold text-ink-muted">
        {pathname === '/weigh-ins'
          ? 'Context navigation only. Recording stays personal; choose group shares explicitly in the form.'
          : 'Personal tracking is separate from challenge views. Choosing a context never changes sharing.'}
      </p>
      <div ref={row} className="app-nav-scroll max-w-full overflow-x-auto py-2">
        <ul className="flex w-max min-w-full gap-2">
          {[
            {
              id: '',
              label: 'Personal tracking',
              to: challengeTabDestination(pathname),
            },
            ...challenges.map((challenge) => ({
              id: challenge.id,
              label: `${challenge.kind === 'personal' ? 'Personal' : 'Group'} · ${challenge.name}`,
              to: challengeTabDestination(pathname, challenge),
            })),
          ].map(({ id, label, to }) => {
            const active = id ? selected === id : personalPage && !selected
            return (
              <li key={id}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${active ? 'border-forest-800 bg-forest-800 text-white' : 'border-line bg-panel text-forest-800 hover:bg-forest-50'}`}
                >
                  {label}
                  {active ? <span className="sr-only"> (selected)</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading authorized challenge contexts…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-danger-800">
          {error}
        </p>
      ) : selected && !challenges.some(({ id }) => id === selected) ? (
        <p role="status" className="text-sm text-ink-muted">
          That challenge context is unavailable for this account. Personal
          tracking remains available.
        </p>
      ) : challenges.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No authorized challenge contexts. Personal tracking needs no
          challenge.
        </p>
      ) : null}
    </nav>
  )
}

export function ChallengeContextTabs() {
  const { state: auth } = useOptionalAuth()
  const { pathname } = useLocation()
  const persistence = useMemo(() => createPersistence(auth), [auth])
  const key = `${auth.status}:${auth.user?.id ?? ''}:${persistence.mode}`
  const [snapshot, setSnapshot] = useState({
    key: '',
    challenges: [] as Challenge[],
    loading: true,
    error: '',
  })
  useEffect(() => {
    let current = true
    const base = {
      key,
      challenges: [] as Challenge[],
      loading: false,
      error: '',
    }
    if (auth.status !== 'signed-in' || !auth.user?.id) {
      setSnapshot(base)
      return
    }
    if (persistence.mode === 'unavailable') {
      setSnapshot({
        ...base,
        error:
          'Challenge contexts are unavailable. Personal tracking remains separate.',
      })
      return
    }
    setSnapshot({ ...base, loading: true })
    void persistence.repositories.challenges
      .listVisibleToUser(auth.user.id)
      .then((result) => {
        if (current)
          setSnapshot(
            result.state === 'error'
              ? {
                  ...base,
                  error: 'Authorized challenge contexts could not be loaded.',
                }
              : { ...base, challenges: result.data },
          )
      })
      .catch(() => {
        if (current)
          setSnapshot({
            ...base,
            error: 'Authorized challenge contexts could not be loaded.',
          })
      })
    return () => {
      current = false
    }
  }, [auth.status, auth.user?.id, key, persistence, pathname])
  if (auth.status !== 'signed-in') return null
  const current =
    snapshot.key === key
      ? snapshot
      : { challenges: [], loading: true, error: '' }
  return <ChallengeTabs {...current} />
}

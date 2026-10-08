import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { AuthSessionUI } from '../auth/AuthSessionUI'
import { useOptionalAuth } from '../auth/useAuth'
import { Button } from '../components/ui'
import { ChallengeContextTabs } from '../components/ChallengeContextTabs'
import {
  NavigationSafetyContext,
  type NavigationBlock,
} from '../components/navigationSafety'

type AppLayoutProps = {
  children: ReactNode
}

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Challenges', to: '/challenges' },
  { label: 'My progress', to: '/progress' },
  { label: 'Group', to: '/group' },
  { label: 'Goals', to: '/goals' },
  { label: 'Weigh-in', to: '/weigh-ins' },
]

function withSelectedChallenge(to: string, search: string, from: string) {
  // Personal destinations must never inherit a challenge selection.
  if (
    ['/dashboard', '/weigh-ins'].includes(to) ||
    (to === '/progress' &&
      !['/progress', '/group', '/goals', '/challenges'].includes(from))
  )
    return to
  const challengeId = new URLSearchParams(search).get('challenge')

  if (!challengeId) return to

  const params = new URLSearchParams({ challenge: challengeId })
  return `${to}?${params.toString()}`
}

/** Shared live shell; route guards and each page's real data remain unchanged. */
export function AppLayout({ children }: AppLayoutProps) {
  const { search, pathname } = useLocation()
  const { state } = useOptionalAuth()
  const navigate = useNavigate()
  const blockers = useRef(new Map<symbol, NavigationBlock>())
  const safety = useMemo(
    () => ({
      register: (token: symbol, value: NavigationBlock | null) => {
        if (value) blockers.current.set(token, value)
        else blockers.current.delete(token)
      },
      unregister: (token: symbol) => {
        blockers.current.delete(token)
      },
    }),
    [],
  )
  const [pending, setPending] = useState<{
    to: string
    saving: boolean
    owner: string
  } | null>(null)
  const owner = `${state.status}:${state.user?.id ?? ''}`
  useEffect(() => {
    setPending(null)
  }, [owner])
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const currentPending = pending?.owner === owner ? pending : null
  useEffect(() => {
    const dialog = confirmDialog.current
    if (currentPending) dialog?.showModal()
    return () => dialog?.close()
  }, [currentPending])
  const contextPage =
    ['/challenges', '/progress', '/goals', '/weigh-ins'].includes(pathname) ||
    (pathname === '/' && new URLSearchParams(search).has('challenge'))
  const personalHome =
    pathname === '/today' ||
    (pathname === '/' &&
      !new URLSearchParams(search).has('challenge') &&
      state.status === 'signed-in')

  return (
    <NavigationSafetyContext.Provider value={safety}>
      <div
        className="flex min-h-screen flex-col bg-page text-ink"
        onClickCapture={(event) => {
          const anchor =
            event.target instanceof Element ? event.target.closest('a') : null
          if (
            !anchor ||
            anchor.target ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return
          const target = new URL(anchor.href)
          if (
            target.origin !== window.location.origin ||
            blockers.current.size === 0
          )
            return
          const to = `${target.pathname}${target.search}${target.hash}`
          if (
            to === `${pathname}${search}` ||
            (pathname === '/weigh-ins' && target.pathname === pathname)
          )
            return
          event.preventDefault()
          event.stopPropagation()
          setPending({
            to,
            saving: [...blockers.current.values()].includes('saving'),
            owner,
          })
        }}
      >
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
            <Link
              className="w-fit shrink-0 rounded-md text-lg font-extrabold tracking-tight text-forest-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-700"
              to={withSelectedChallenge('/', search, pathname)}
            >
              Slimpossible
            </Link>

            <div className="flex min-w-0 flex-col gap-3 xl:flex-1 xl:flex-row xl:items-center xl:justify-end xl:gap-5">
              <nav
                aria-label="Primary navigation"
                className="app-nav-scroll min-w-0 max-w-full overflow-x-auto"
              >
                <ul className="flex w-max min-w-full items-center gap-1 py-1 text-sm font-semibold">
                  {navigationItems.map(({ label, to }) => (
                    <li className="shrink-0" key={to}>
                      <NavLink
                        aria-current={
                          to === '/dashboard' && personalHome
                            ? 'page'
                            : undefined
                        }
                        className={({ isActive }) =>
                          isActive || (to === '/dashboard' && personalHome)
                            ? 'inline-flex min-h-10 items-center rounded-xl border border-forest-800 bg-forest-50 px-3 py-2 font-bold text-forest-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                            : 'inline-flex min-h-10 items-center rounded-xl border border-transparent px-3 py-2 text-ink-muted transition-colors hover:border-line hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                        }
                        end={to === '/'}
                        to={withSelectedChallenge(to, search, pathname)}
                      >
                        {label}
                      </NavLink>
                    </li>
                  ))}
                  <li className="shrink-0">
                    <Button
                      aria-label="Group history, coming soon"
                      className="min-h-10 gap-2 rounded-xl border-dashed px-3 py-2 text-ink-muted sm:px-4"
                      disabled
                      type="button"
                      variant="ghost"
                    >
                      <span>Group history</span>
                      <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                        Coming soon
                      </span>
                    </Button>
                  </li>
                </ul>
              </nav>
              <div className="shrink-0">
                <AuthSessionUI />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-7 sm:px-8 sm:py-10">
          {contextPage ? <ChallengeContextTabs /> : null}
          {children}
        </main>
        {currentPending ? (
          <dialog
            ref={confirmDialog}
            aria-labelledby="discard-editor-title"
            onCancel={(event) => {
              event.preventDefault()
              setPending(null)
            }}
            className="m-auto max-w-sm rounded-2xl border border-line bg-panel p-6 text-ink backdrop:bg-black/40"
          >
            <h2 id="discard-editor-title" className="text-xl font-bold">
              {currentPending.saving
                ? 'Save in progress'
                : 'Discard unsaved input?'}
            </h2>
            <p className="mt-3 text-sm text-ink-muted">
              {currentPending.saving
                ? 'Stay here until the save or deletion finishes. It cannot be cancelled by switching contexts.'
                : 'Your unsaved input will not be carried to another view or saved. Stay here to keep editing, or discard it and leave.'}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                autoFocus
                onClick={() => setPending(null)}
              >
                Stay
              </Button>
              {!currentPending.saving ? (
                <Button
                  onClick={() => {
                    const to = currentPending.to
                    setPending(null)
                    navigate(to)
                  }}
                >
                  Discard and leave
                </Button>
              ) : null}
            </div>
          </dialog>
        ) : null}

        <footer className="border-t border-line bg-panel">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-ink-muted sm:px-8">
            Build sustainable progress, one day at a time.
          </div>
        </footer>
      </div>
    </NavigationSafetyContext.Provider>
  )
}

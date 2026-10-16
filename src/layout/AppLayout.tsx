import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  UNSAFE_DataRouterContext,
} from 'react-router-dom'

import { AuthSessionUI } from '../auth/AuthSessionUI'
import { useOptionalAuth } from '../auth/useAuth'
import { ChallengeContextTabs } from '../components/ChallengeContextTabs'
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog'
import { RouterNavigationGuard } from '../components/RouterNavigationGuard'
import {
  NavigationSafetyContext,
  type NavigationBlock,
} from '../components/navigationSafety'

type AppLayoutProps = {
  children: ReactNode
}

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Group', to: '/group' },
]

const publicNavigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Log in', to: '/login' },
  { label: 'Register', to: '/register' },
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
  const { search, pathname, state: locationState } = useLocation()
  const { state } = useOptionalAuth()
  const signedIn = state.status === 'signed-in'
  const personalHome =
    ['/today', '/progress', '/goals', '/challenges'].includes(pathname) ||
    (pathname === '/' &&
      !new URLSearchParams(search).has('challenge') &&
      signedIn)
  const sharedLayout =
    ['/dashboard', '/group', '/login', '/register'].includes(pathname) ||
    (pathname === '/' && personalHome)
  const dashboardShell =
    pathname === '/dashboard' || (pathname === '/' && personalHome)
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
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (blockers.current.size) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])
  useEffect(() => {
    setPending(null)
  }, [owner])
  const currentPending = pending?.owner === owner ? pending : null
  const contextPage =
    ['/challenges', '/weigh-ins'].includes(pathname) ||
    (pathname === '/' && new URLSearchParams(search).has('challenge'))

  return (
    <NavigationSafetyContext.Provider value={safety}>
      <div
        className={`app-shell flex min-h-screen flex-col bg-page text-ink ${signedIn ? 'signed-in-shell' : ''} ${sharedLayout ? 'shared-layout' : ''} ${dashboardShell ? 'dashboard-shell' : ''} ${pathname === '/group' ? 'group-shell' : ''}`}
        onClickCapture={(event) => {
          if (dataRouter) return
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
        <header className="app-shell-header border-b border-line bg-panel">
          <div className="app-shell-header-inner mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
            <Link
              className="app-shell-brand inline-flex min-h-11 w-fit shrink-0 items-center rounded-md border border-transparent px-2 text-lg font-extrabold tracking-tight text-forest-800 transition-colors hover:border-line hover:bg-page hover:text-ink focus-visible:border-line focus-visible:bg-page focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-700"
              to={state.status === 'signed-in' ? '/dashboard' : '/'}
            >
              Slimpossible
            </Link>

            <div className="app-shell-header-actions flex min-w-0 flex-col gap-3 xl:flex-1 xl:flex-row xl:items-center xl:justify-end xl:gap-5">
              <nav
                aria-label="Primary navigation"
                className="app-nav-scroll min-w-0 max-w-full overflow-x-auto"
              >
                <ul className="flex w-max min-w-full items-center gap-1 py-1 text-sm font-semibold">
                  {(signedIn ? navigationItems : publicNavigationItems).map(
                    ({ label, to }) => {
                      const active =
                        pathname === to ||
                        (to !== '/' && pathname.startsWith(`${to}/`)) ||
                        (to === '/dashboard' && personalHome)
                      return (
                        <li className="shrink-0" key={to}>
                          <Link
                            aria-current={active ? 'page' : undefined}
                            className={
                              active
                                ? 'inline-flex min-h-10 items-center rounded-xl border border-forest-800 bg-forest-50 px-3 py-2 font-bold text-forest-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                                : 'inline-flex min-h-10 items-center rounded-xl border border-transparent px-3 py-2 text-ink-muted transition-colors hover:border-line hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                            }
                            state={
                              to === '/login' || to === '/register'
                                ? locationState
                                : undefined
                            }
                            to={
                              signedIn
                                ? withSelectedChallenge(to, search, pathname)
                                : to
                            }
                          >
                            {label}
                          </Link>
                        </li>
                      )
                    },
                  )}
                </ul>
              </nav>
              {signedIn ||
              state.status === 'loading' ||
              state.status === 'error' ? (
                <div className="shrink-0">
                  <AuthSessionUI />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="app-shell-main mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-7 sm:px-8 sm:py-10">
          {contextPage ? <ChallengeContextTabs /> : null}
          {children}
        </main>
        {dataRouter ? (
          <RouterNavigationGuard blockers={blockers} owner={owner} />
        ) : null}
        {currentPending ? (
          <UnsavedChangesDialog
            saving={currentPending.saving}
            onStay={() => setPending(null)}
            onDiscard={() => {
              const to = currentPending.to
              setPending(null)
              navigate(to)
            }}
          />
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

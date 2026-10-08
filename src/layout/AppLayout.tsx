import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { AuthSessionUI } from '../auth/AuthSessionUI'
import { useOptionalAuth } from '../auth/useAuth'
import { Button } from '../components/ui'

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

function withSelectedChallenge(to: string, search: string) {
  // Personal destinations must never inherit a challenge selection.
  if (['/dashboard', '/progress', '/weigh-ins'].includes(to)) return to
  const challengeId = new URLSearchParams(search).get('challenge')

  if (!challengeId) return to

  const params = new URLSearchParams({ challenge: challengeId })
  return `${to}?${params.toString()}`
}

/** Shared live shell; route guards and each page's real data remain unchanged. */
export function AppLayout({ children }: AppLayoutProps) {
  const { search, pathname } = useLocation()
  const { state } = useOptionalAuth()
  const personalHome =
    pathname === '/today' ||
    (pathname === '/' &&
      !new URLSearchParams(search).has('challenge') &&
      state.status === 'signed-in')

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
          <Link
            className="w-fit shrink-0 rounded-md text-lg font-extrabold tracking-tight text-forest-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-700"
            to={withSelectedChallenge('/', search)}
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
                        to === '/dashboard' && personalHome ? 'page' : undefined
                      }
                      className={({ isActive }) =>
                        isActive || (to === '/dashboard' && personalHome)
                          ? 'inline-flex min-h-10 items-center rounded-xl border border-forest-800 bg-forest-50 px-3 py-2 font-bold text-forest-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                          : 'inline-flex min-h-10 items-center rounded-xl border border-transparent px-3 py-2 text-ink-muted transition-colors hover:border-line hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 sm:px-4'
                      }
                      end={to === '/'}
                      to={withSelectedChallenge(to, search)}
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-7 sm:px-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 text-sm text-ink-muted sm:px-8">
          Build sustainable progress, one day at a time.
        </div>
      </footer>
    </div>
  )
}

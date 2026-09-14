import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

type AppLayoutProps = {
  children: ReactNode
}

const navigationItems = [
  { label: 'Today', to: '/today' },
  { label: 'Progress', to: '/progress' },
  { label: 'Goals', to: '/goals' },
]

/** Shared shell with a content slot for future routed pages. */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-slate-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <Link
            className="text-lg font-bold tracking-tight text-emerald-800"
            to="/"
          >
            Slimpossible
          </Link>

          <nav aria-label="Primary navigation" className="overflow-x-auto">
            <ul className="flex min-w-max items-center gap-5 text-sm font-semibold text-slate-600">
              {navigationItems.map(({ label, to }) => (
                <li key={to}>
                  <NavLink
                    className={({ isActive }) =>
                      `transition hover:text-emerald-700 ${
                        isActive ? 'text-emerald-700' : ''
                      }`
                    }
                    to={to}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-8 sm:px-10 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-5 text-sm text-slate-500 sm:px-10">
          Build sustainable progress, one day at a time.
        </div>
      </footer>
    </div>
  )
}

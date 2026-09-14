import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type PlaceholderPageProps = {
  children?: ReactNode
  description: string
  title: string
}

function PlaceholderPage({
  children,
  description,
  title,
}: PlaceholderPageProps) {
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto flex w-full max-w-4xl flex-1 items-center"
    >
      <div className="w-full rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Slimpossible
        </p>
        <h1
          id="page-title"
          className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl"
        >
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          {description}
        </p>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  )
}

export function HomePage() {
  return (
    <section className="w-full" aria-labelledby="welcome-title">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Slimpossible
          </p>
          <h1
            id="welcome-title"
            className="mt-5 max-w-md text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl"
          >
            Your challenge starts here.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            A calm, focused space for building sustainable progress together.
          </p>
          <div
            className="mt-8 inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800"
            role="status"
          >
            Tailwind is working
          </div>
        </div>

        <div className="flex min-h-64 items-center justify-center bg-emerald-800 p-8 text-white md:min-h-full">
          <div className="text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-700 text-4xl shadow-inner shadow-emerald-950/20">
              ✓
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Foundation ready
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function TodayPage() {
  return (
    <PlaceholderPage
      description="Your daily challenge space will live here."
      title="Today"
    />
  )
}

export function ProgressPage() {
  return (
    <PlaceholderPage
      description="Your progress history will live here."
      title="Progress"
    />
  )
}

export function GoalsPage() {
  return (
    <PlaceholderPage
      description="Your goals and milestones will live here."
      title="Goals"
    />
  )
}

export function NotFoundPage() {
  return (
    <PlaceholderPage
      description="The page you requested does not exist."
      title="Page not found"
    >
      <Link className="text-emerald-700 underline" to="/">
        Return home
      </Link>
    </PlaceholderPage>
  )
}

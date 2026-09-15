import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  ProgressBar,
  StatusPill,
} from '../components/ui'

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
      <Card className="w-full p-8 sm:p-12">
        <PageHeader description={description} title={title}>
          <StatusPill>Placeholder</StatusPill>
          {children}
        </PageHeader>
      </Card>
    </section>
  )
}

export function HomePage() {
  return (
    <section className="w-full" aria-labelledby="welcome-title">
      <Card className="mx-auto grid max-w-4xl overflow-hidden p-0 md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-8 sm:p-12">
          <PageHeader
            description="A calm, focused space for building sustainable progress together."
            title="Your challenge starts here."
            titleId="welcome-title"
          >
            <StatusPill tone="success">Tailwind is working</StatusPill>
            <Link
              className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline"
              to="/challenge/setup"
            >
              Set up a challenge
            </Link>
          </PageHeader>
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
      </Card>
    </section>
  )
}

export function TodayPage() {
  return (
    <PlaceholderPage
      description="Your daily challenge space will live here."
      title="Today"
    >
      <Button disabled>Coming soon</Button>
    </PlaceholderPage>
  )
}

export function ProgressPage() {
  return (
    <PlaceholderPage
      description="Your progress history will live here."
      title="Progress"
    >
      <ProgressBar label="Progress preview" value={0} />
    </PlaceholderPage>
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

import { useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useOptionalAuth } from '../auth/useAuth'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
} from '../components/ui'
import {
  WeightPageHeader,
  RecordWeightAction,
} from '../components/WeightPageHeader'
import { DashboardChallengeActions } from '../components/DashboardChallengeActions'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import {
  personalHistory,
  formatPersonalWeight,
  formatPersonalChange,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'
import { PersonalHistoryContent } from './PersonalHistoryContent'
import { DashboardGoals } from '../components/DashboardGoals'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'

export function PersonalDashboardPage({
  initialTab = 'overview',
}: {
  initialTab?: 'overview' | 'progress'
}) {
  const workspace = usePersonalWorkspace()
  return (
    <PersonalDashboardWorkspace workspace={workspace} initialTab={initialTab} />
  )
}

export function PersonalDashboardWorkspace({
  workspace,
  initialTab = 'overview',
}: {
  workspace: PersonalWorkspace
  initialTab?: 'overview' | 'progress'
}) {
  const [params] = useSearchParams()
  const { hash, pathname } = useLocation()
  const tab =
    params.get('tab') === 'overview'
      ? 'overview'
      : params.get('tab') === 'progress'
        ? 'progress'
        : initialTab
  const tabLink = (value: string) => {
    const query = new URLSearchParams(params)
    query.set('tab', value)
    return `/dashboard?${query}`
  }
  useEffect(() => {
    if (
      tab === 'progress' &&
      (hash === '#goals' || pathname === '/goals') &&
      workspace.personal.state === 'ready' &&
      workspace.contexts.state === 'ready'
    )
      document.getElementById('goals')?.scrollIntoView?.({ block: 'start' })
  }, [tab, hash, pathname, workspace.personal.state, workspace.contexts.state])
  const { state: auth } = useOptionalAuth()
  const today = personalWeighInToday()
  const { latest } = personalHistory(workspace.personal.data, today)
  const recent = personalHistory(workspace.personal.data, today, 30)
  const todayEntry = workspace.personal.data.find(
    (entry) => entry.date === today,
  )
  return (
    <section
      aria-labelledby="dashboard-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <WeightPageHeader action={<RecordWeightAction workspace={workspace} />}>
        <PageHeader
          title="Dashboard"
          titleId="dashboard-title"
          description="Your personal home. Track weight and progress with or without a challenge."
        />
      </WeightPageHeader>
      <nav
        role="tablist"
        aria-label="Dashboard views"
        className="flex gap-2"
        onKeyDown={(event) => {
          const tabs = [
            ...event.currentTarget.querySelectorAll<HTMLAnchorElement>(
              '[role="tab"]',
            ),
          ]
          const index = tabs.indexOf(
            document.activeElement as HTMLAnchorElement,
          )
          const next =
            event.key === 'ArrowRight' || event.key === 'ArrowLeft'
              ? (index + 1) % tabs.length
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : null
          if (next !== null) {
            event.preventDefault()
            tabs[next].focus()
            tabs[next].click()
          }
        }}
      >
        {(['overview', 'progress'] as const).map((value) => (
          <Link
            key={value}
            id={`dashboard-${value}-tab`}
            role="tab"
            aria-selected={tab === value}
            aria-controls={`dashboard-${value}-panel`}
            tabIndex={tab === value ? 0 : -1}
            to={tabLink(value)}
            className={`inline-flex min-h-11 items-center rounded-full border px-5 py-2 font-semibold ${tab === value ? 'border-forest-800 bg-forest-800 text-white' : 'border-line bg-panel text-forest-800'}`}
          >
            {value === 'overview' ? 'Overview' : 'Progress'}
          </Link>
        ))}
      </nav>
      {params.get('navigation') === 'challenge-unavailable' ? (
        <FeedbackPanel tone="info">
          That challenge is not available to this account. You are viewing your
          personal Dashboard; choose an authorized Group from the Group
          workspace if needed.
        </FeedbackPanel>
      ) : null}
      <div
        id={`dashboard-${tab === 'overview' ? 'progress' : 'overview'}-panel`}
        role="tabpanel"
        aria-labelledby={`dashboard-${tab === 'overview' ? 'progress' : 'overview'}-tab`}
        hidden
      />
      <div
        id={`dashboard-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`dashboard-${tab}-tab`}
        className="space-y-6"
      >
        {tab === 'progress' ? (
          <>
            <PersonalHistoryContent
              key={`history:${workspace.ownerKey}`}
              workspace={workspace}
            />
            <DashboardGoals
              key={`goals:${workspace.ownerKey}`}
              workspace={workspace}
            />
          </>
        ) : (
          <>
            {workspace.personal.state === 'loading' ? (
              <FeedbackPanel tone="loading">
                Loading your personal Dashboard…
              </FeedbackPanel>
            ) : workspace.personal.state === 'error' ? (
              <FeedbackPanel tone="error">
                {workspace.personal.error}
              </FeedbackPanel>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                  <Card className="space-y-4 p-6">
                    <h2 className="text-lg font-bold">
                      Latest personal weight
                    </h2>
                    <p className="text-4xl font-extrabold tracking-tight">
                      {latest
                        ? formatPersonalWeight(latest.weightKg)
                        : 'No record yet'}
                    </p>
                    {latest ? (
                      <time
                        className="block text-sm text-ink-muted"
                        dateTime={latest.date}
                      >
                        Recorded {latest.date}
                      </time>
                    ) : (
                      <p className="text-sm text-ink-muted">
                        Your first personal entry can be saved without creating
                        or joining a challenge.
                      </p>
                    )}
                    <StatusPill>
                      {todayEntry ? 'Logged today' : 'Not logged today'}
                    </StatusPill>
                    <p className="text-sm text-ink-muted">
                      {todayEntry
                        ? 'Today’s entry is already saved. Corrections update that same entry.'
                        : 'No entry for today yet. Your last saved weight is not a check-in for today.'}
                    </p>
                    <Link
                      className="inline-flex min-h-11 items-center text-sm font-bold text-forest-800 underline"
                      to="/dashboard?tab=progress"
                    >
                      My Progress and private history
                    </Link>
                  </Card>
                  <Card className="min-w-0 p-6">
                    <h2 className="text-lg font-bold">Your last 30 days</h2>
                    <p className="mt-2 text-sm text-ink-muted">
                      Only real saved dates and weights. Missing days are not
                      estimated.
                    </p>
                    {recent.history.length ? (
                      <PersonalProgressChart
                        weighIns={recent.history.map((entry) => ({
                          date: entry.date,
                          weightKg: entry.weightKg,
                          participantId: workspace.userId,
                        }))}
                      />
                    ) : (
                      <FeedbackPanel className="mt-5" tone="empty">
                        No saved entries in the last 30 days. Your trend will
                        appear after a check-in.
                      </FeedbackPanel>
                    )}
                    {recent.changeKg !== null ? (
                      <p className="mt-4 text-sm font-semibold">
                        Change between {recent.history.at(-1)!.date} and{' '}
                        {recent.latest!.date}:{' '}
                        {formatPersonalChange(recent.changeKg)}.
                      </p>
                    ) : recent.history.length === 1 ? (
                      <p className="mt-4 text-sm text-ink-muted">
                        Two saved entries are needed to compare a trend.
                      </p>
                    ) : null}
                  </Card>
                </div>
              </>
            )}
            <Button variant="secondary" onClick={workspace.refresh}>
              Refresh Dashboard
            </Button>
            {auth.status === 'signed-in' ? (
              <Card
                className="space-y-4 p-6"
                role="region"
                aria-labelledby="dashboard-profile-title"
              >
                <h2 id="dashboard-profile-title" className="text-lg font-bold">
                  About you
                </h2>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {auth.user.displayName?.trim() ? (
                    <div>
                      <dt className="text-sm text-ink-muted">Name</dt>
                      <dd className="break-words font-semibold">
                        {auth.user.displayName}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-sm text-ink-muted">Email</dt>
                    <dd className="break-all font-semibold">
                      {auth.user.email}
                    </dd>
                  </div>
                </dl>
              </Card>
            ) : null}
          </>
        )}
      </div>
      <DashboardChallengeActions workspace={workspace} />
      {tab === 'overview' ? (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800 underline"
          to="/weigh-ins"
        >
          Open full weigh-in page
        </Link>
      ) : null}
    </section>
  )
}

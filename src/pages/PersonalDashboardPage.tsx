import { useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  usePersonalWorkspace,
  type PersonalWorkspace,
} from '../data/usePersonalWorkspace'
import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
} from '../components/ui'
import { RecordWeightAction } from '../components/WeightPageHeader'
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
  const today = personalWeighInToday()
  const { latest } = personalHistory(workspace.personal.data, today)
  const recent = personalHistory(workspace.personal.data, today, 30)
  const todayEntry = workspace.personal.data.find(
    (entry) => entry.date === today,
  )
  const choices =
    workspace.contexts.state === 'ready'
      ? workspace.contexts.data.challenges.filter((challenge) =>
          workspace.contexts.data.participants.some(
            (member) =>
              member.challengeId === challenge.id &&
              member.userId === workspace.userId &&
              member.status === 'active',
          ),
        )
      : []
  const selected = params.get('challenge')
    ? choices.find((challenge) => challenge.id === params.get('challenge'))
    : choices[0]
  const member = selected
    ? workspace.contexts.data.participants.find(
        (row) =>
          row.challengeId === selected.id &&
          row.userId === workspace.userId &&
          row.status === 'active',
      )
    : undefined
  const referenceWeightKg =
    member &&
    Number.isFinite(member.targetWeightKg) &&
    member.targetWeightKg > 0 &&
    (selected?.kind !== 'group' ||
      member.targetWeightKg <= member.startingWeightKg)
      ? member.targetWeightKg
      : undefined
  const referenceLabel = selected ? `${selected.name} target` : undefined
  return (
    <section
      data-weight-page-header
      aria-labelledby="dashboard-title"
      className="dashboard-workspace mx-auto w-full max-w-6xl space-y-6"
    >
      <header>
        <PageHeader
          title="Dashboard"
          titleId="dashboard-title"
          description="Your personal home. Track weight and progress with or without a challenge."
        />
      </header>
      <div className={tab === 'overview' ? 'dashboard-top-grid' : ''}>
        {tab === 'overview' ? (
          <Card className="dashboard-latest p-5">
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
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-sm font-semibold text-ink-muted">
                    Latest personal weight
                  </h2>
                  <StatusPill>
                    {todayEntry ? 'Logged today' : 'Not logged today'}
                  </StatusPill>
                </div>
                <p className="my-3 text-4xl font-extrabold tracking-tight">
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
                    Your first personal entry can be saved without creating or
                    joining a challenge.
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-muted">
                  {todayEntry
                    ? 'Today’s entry is already saved. Corrections update that same entry.'
                    : 'No entry for today yet. Your last saved weight is not a check-in for today.'}
                </p>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-forest-800 underline"
                  to="/dashboard?tab=progress"
                >
                  My Progress and private history
                </Link>
              </>
            )}
          </Card>
        ) : null}
        <DashboardChallengeActions
          workspace={workspace}
          recordAction={
            <RecordWeightAction workspace={workspace} presentation="card" />
          }
        />
      </div>
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
            event.key === 'ArrowRight'
              ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft'
                ? (index - 1 + tabs.length) % tabs.length
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
            className={`inline-flex min-h-11 items-center rounded-xl border px-5 py-2 font-semibold ${tab === value ? 'border-forest-800 bg-forest-50 text-forest-800' : 'border-line bg-panel text-ink-muted'}`}
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
              referenceWeightKg={referenceWeightKg}
              referenceLabel={referenceLabel}
            />
            <DashboardGoals
              key={`goals:${workspace.ownerKey}`}
              workspace={workspace}
            />
          </>
        ) : (
          <>
            {workspace.personal.state === 'ready' ? (
              <Card className="min-w-0 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Your last 30 days</h2>
                  <span className="text-sm text-ink-muted">
                    Personal recorded weights
                  </span>
                </div>
                {recent.history.length ? (
                  <PersonalProgressChart
                    weighIns={recent.history.map((entry) => ({
                      date: entry.date,
                      weightKg: entry.weightKg,
                      participantId: workspace.userId,
                    }))}
                    referenceWeightKg={referenceWeightKg}
                    referenceLabel={referenceLabel}
                  />
                ) : (
                  <FeedbackPanel className="mt-5" tone="empty">
                    No saved entries in the last 30 days. Your trend will appear
                    after a check-in.
                  </FeedbackPanel>
                )}
              </Card>
            ) : null}
            {workspace.personal.state === 'ready' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-5">
                  <p className="text-sm text-ink-muted">Change in this range</p>
                  <p className="mt-2 text-2xl font-bold">
                    {recent.changeKg !== null
                      ? formatPersonalChange(recent.changeKg)
                      : '—'}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {recent.history.length > 1
                      ? `Change between ${recent.history.at(-1)!.date} and ${recent.latest!.date}.`
                      : 'Two saved entries are needed to compare a trend.'}
                  </p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-ink-muted">
                    Selected goal reference
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {referenceWeightKg
                      ? formatPersonalWeight(referenceWeightKg)
                      : 'No target selected'}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {selected?.name ??
                      'Your personal recording never requires a goal.'}
                  </p>
                </Card>
                <Card className="p-5">
                  <p className="text-sm text-ink-muted">Latest recorded date</p>
                  <p className="mt-2 text-xl font-bold">
                    {latest?.date ?? 'No saved date'}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    Only saved entries are shown. Missing days are not
                    estimated.
                  </p>
                </Card>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={workspace.refresh}>
                Refresh Dashboard
              </Button>
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800 underline"
                to="/weigh-ins"
              >
                Open full weigh-in page
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

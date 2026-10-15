import { useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  usePersonalWorkspace,
  type PersonalWorkspace,
} from '../data/usePersonalWorkspace'
import { Card, FeedbackPanel, PageHeader, StatusPill } from '../components/ui'
import { RecordWeightAction } from '../components/WeightPageHeader'
import { DashboardChallengeActions } from '../components/DashboardChallengeActions'
import {
  personalHistory,
  formatPersonalWeight,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'
import { PersonalHistoryContent } from './PersonalHistoryContent'
import { DashboardGoals } from '../components/DashboardGoals'

type LegacyTab = 'overview' | 'progress'
export function PersonalDashboardPage({
  initialTab = 'overview',
}: {
  initialTab?: LegacyTab
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
  initialTab?: LegacyTab
}) {
  const [params] = useSearchParams()
  const { hash, pathname, search } = useLocation()
  const scrolled = useRef('')
  useEffect(() => {
    const navigation = `${workspace.ownerKey}:${pathname}${search}${hash}`
    if (
      scrolled.current === navigation ||
      workspace.personal.state !== 'ready' ||
      workspace.contexts.state === 'loading'
    )
      return
    scrolled.current = navigation
    // Legacy tab links still reach their section of the combined Dashboard.
    const target = hash
      ? hash.slice(1)
      : pathname === '/goals'
        ? 'goals'
        : params.get('tab') === 'progress' ||
            (initialTab === 'progress' && !params.has('tab'))
          ? 'dashboard-progress-panel'
          : null
    if (target)
      document.getElementById(target)?.scrollIntoView?.({ block: 'start' })
  }, [
    hash,
    pathname,
    search,
    params,
    initialTab,
    workspace.ownerKey,
    workspace.personal.state,
    workspace.contexts.state,
  ])
  const today = personalWeighInToday()
  const { latest } = personalHistory(workspace.personal.data, today)
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
      <div id="dashboard-overview-panel" className="dashboard-top-grid">
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
                to={{ pathname, search, hash: '#personal-history' }}
              >
                My Progress and private history
              </Link>
            </>
          )}
        </Card>
        <DashboardChallengeActions
          workspace={workspace}
          recordAction={
            <RecordWeightAction workspace={workspace} presentation="card" />
          }
        />
      </div>
      {params.get('navigation') === 'challenge-unavailable' ? (
        <FeedbackPanel tone="info">
          That challenge is not available to this account. You are viewing your
          personal Dashboard; choose an authorized Group from the Group
          workspace if needed.
        </FeedbackPanel>
      ) : null}
      <div id="dashboard-progress-panel">
        <PersonalHistoryContent
          key={`history:${workspace.ownerKey}`}
          workspace={workspace}
          referenceWeightKg={referenceWeightKg}
          referenceLabel={selected ? `${selected.name} target` : undefined}
        >
          <DashboardGoals
            key={`goals:${workspace.ownerKey}`}
            workspace={workspace}
          />
        </PersonalHistoryContent>
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
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
import {
  workspaceSection,
  workspaceSectionLink,
} from '../models/workspaceNavigation'
import { RecordWeightAction } from '../components/WeightPageHeader'
import { DashboardChallengeActions } from '../components/DashboardChallengeActions'
import {
  personalHistory,
  formatPersonalWeight,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'
import { PersonalHistoryContent } from './PersonalHistoryContent'
import { DashboardGoals } from '../components/DashboardGoals'
import { personalGoalChoices } from '../models/personalGoalChoices'

type LegacyTab = 'overview' | 'progress'
export function PersonalDashboardPage({
  initialTab = 'overview',
}: {
  initialTab?: LegacyTab
}) {
  const workspace = usePersonalWorkspace()
  const location = useLocation()
  if (
    workspaceSection(
      'dashboard',
      location.pathname,
      location.search,
      location.hash,
    ) === 'weigh-ins'
  )
    return (
      <Navigate
        replace
        to={workspaceSectionLink('dashboard', 'weigh-ins', location.search)}
      />
    )
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
  const section =
    !params.has('tab') && !hash && initialTab === 'progress'
      ? 'progress'
      : workspaceSection('dashboard', pathname, search, hash)
  const scrolled = useRef('')
  const [saveConfirmation, setSaveConfirmation] = useState<{
    ownerKey: string
    count: number
  } | null>(null)
  useEffect(() => {
    if (saveConfirmation?.ownerKey !== workspace.ownerKey) return
    const confirmationCount = saveConfirmation.count
    const timeout = window.setTimeout(() => {
      setSaveConfirmation((current) =>
        current?.ownerKey === workspace.ownerKey &&
        current.count === confirmationCount
          ? null
          : current,
      )
    }, 4000)
    return () => window.clearTimeout(timeout)
  }, [saveConfirmation, workspace.ownerKey])
  useEffect(() => {
    const navigation = `${workspace.ownerKey}:${pathname}${search}${hash}`
    if (
      scrolled.current === navigation ||
      workspace.personal.state !== 'ready' ||
      workspace.contexts.state === 'loading'
    )
      return
    scrolled.current = navigation
    // Resolve supported anchors only after their selected panel is mounted.
    const target = hash
      ? hash.slice(1)
      : pathname === '/goals'
        ? 'goals'
        : section === 'progress'
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
    section,
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
      ? personalGoalChoices(
          workspace.userId,
          workspace.contexts.data.challenges,
          workspace.contexts.data.participants,
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
          titleTrailing={
            <div className="dashboard-save-confirmation-slot">
              {saveConfirmation?.ownerKey === workspace.ownerKey &&
              saveConfirmation.count ? (
                <>
                  <p
                    key={saveConfirmation.count}
                    className="dashboard-save-confirmation"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    Personal weight saved.
                  </p>
                  <button
                    aria-label="Dismiss save confirmation"
                    className="dashboard-save-confirmation-dismiss"
                    onClick={() => setSaveConfirmation(null)}
                    type="button"
                  >
                    Dismiss
                  </button>
                </>
              ) : null}
            </div>
          }
        />
      </header>
      {section === 'overview' ? (
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
                  to={workspaceSectionLink('dashboard', 'progress', search)}
                >
                  My Progress and private history
                </Link>
              </>
            )}
          </Card>
          <DashboardChallengeActions
            workspace={workspace}
            recordAction={
              <RecordWeightAction
                workspace={workspace}
                presentation="card"
                showSavedFeedback={false}
                onOpen={() => setSaveConfirmation(null)}
                onRecorded={() =>
                  setSaveConfirmation((current) => ({
                    ownerKey: workspace.ownerKey,
                    count:
                      current?.ownerKey === workspace.ownerKey
                        ? current.count + 1
                        : 1,
                  }))
                }
              />
            }
          />
        </div>
      ) : null}
      {params.get('navigation') === 'challenge-unavailable' ? (
        <FeedbackPanel tone="info">
          That challenge is not available to this account. You are viewing your
          personal Dashboard; choose an authorized Group from the Group
          workspace if needed.
        </FeedbackPanel>
      ) : null}
      {section === 'progress' ? (
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
      ) : null}
      {section === 'overview' ? (
        <Button variant="secondary" onClick={workspace.refresh}>
          Refresh Dashboard
        </Button>
      ) : null}
    </section>
  )
}

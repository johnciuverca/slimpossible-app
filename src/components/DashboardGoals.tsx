import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import type { ReachedTargetMilestone } from '../models/targetMilestone'
import { ownDashboardGoal } from '../models/ownDashboardGoal'
import { personalGoalChoices } from '../models/personalGoalChoices'
import { personalWeighInToday } from '../models/personalWeighIn'
import { createParticipantMilestones } from '../models/participantMilestones'
import { MilestoneProgress } from './MilestoneProgress'
import { ChangeTargetDialog } from './ChangeTargetDialog'
import { ChangeStartingWeightDialog } from './ChangeStartingWeightDialog'
import { Button, Card, FeedbackPanel } from './ui'

export function DashboardGoals({
  workspace,
}: {
  workspace: PersonalWorkspace
}) {
  const section = useRef<HTMLElement>(null)
  const choicesNav = useRef<HTMLElement>(null)
  const pendingFocus = useRef<{
    challengeId: string
    control: 'target' | 'starting-weight'
  } | null>(null)
  const [notice, setNotice] = useState<{
    challengeId: string
    message: string
  } | null>(null)
  const [params] = useSearchParams()
  const requested = params.get('challenge')
  const choices = personalGoalChoices(
    workspace.userId,
    workspace.contexts.data.challenges,
    workspace.contexts.data.participants,
  )
  const selected = requested
    ? choices.find((challenge) => challenge.id === requested)
    : choices[0]
  useEffect(() => {
    const nav = choicesNav.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    const bounds = nav.getBoundingClientRect()
    const item = active.getBoundingClientRect()
    if (item.left < bounds.left) nav.scrollLeft -= bounds.left - item.left
    else if (item.right > bounds.right)
      nav.scrollLeft += item.right - bounds.right
  }, [selected?.id, workspace.contexts.key])
  useEffect(() => {
    if (
      pendingFocus.current &&
      workspace.contexts.state === 'ready' &&
      workspace.personal.state === 'ready'
    ) {
      if (selected?.id === pendingFocus.current.challengeId)
        section.current
          ?.querySelector<HTMLButtonElement>(
            pendingFocus.current.control === 'target'
              ? '[data-change-target]'
              : '[data-change-starting-weight]',
          )
          ?.focus()
      pendingFocus.current = null
    }
  }, [workspace.contexts.state, workspace.personal.state, selected?.id])
  return (
    <section
      ref={section}
      id="goals"
      aria-labelledby="dashboard-goals-title"
      className="space-y-5 scroll-mt-6"
    >
      <h2
        id="dashboard-goals-title"
        tabIndex={-1}
        className="text-2xl font-extrabold"
      >
        Goals
      </h2>
      {notice && (!requested || requested === notice.challengeId) ? (
        <p role="status">{notice.message}</p>
      ) : null}
      <p className="text-sm text-ink-muted">
        Your personal targets and milestones. Personal recording never requires
        a challenge.
      </p>
      {workspace.contexts.state === 'loading' ? (
        <FeedbackPanel tone="loading">Loading your goals…</FeedbackPanel>
      ) : workspace.contexts.state === 'error' ? (
        <FeedbackPanel tone="error">
          Your goal choices could not be loaded. Refresh to try again.
        </FeedbackPanel>
      ) : (
        <>
          {choices.length ? (
            <nav
              ref={choicesNav}
              aria-label="Your goal challenges"
              className="app-nav-scroll flex max-w-full gap-2 overflow-x-auto pb-2"
            >
              {choices.map((challenge) => (
                <Link
                  key={challenge.id}
                  aria-current={
                    selected?.id === challenge.id ? 'page' : undefined
                  }
                  to={`/dashboard?${new URLSearchParams({ tab: 'progress', challenge: challenge.id })}#goals`}
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-sm font-semibold ${selected?.id === challenge.id ? 'border-forest-800 bg-forest-800 text-white' : 'border-line bg-panel text-forest-800'}`}
                >
                  {challenge.name}
                </Link>
              ))}
            </nav>
          ) : null}
          {!selected ? (
            <FeedbackPanel tone="empty">
              {choices.length === 0
                ? 'No personal goal yet. Your private history stays available without a goal.'
                : 'This personal goal is unavailable for this account. Choose one of your personal goals above.'}
            </FeedbackPanel>
          ) : (
            <SelectedGoal
              key={`${workspace.ownerKey}:${selected.id}`}
              workspace={workspace}
              challengeId={selected.id}
              onSaved={(control) => {
                setNotice({
                  challengeId: selected.id,
                  message:
                    control === 'target'
                      ? 'Your personal target was saved; refreshing your goal.'
                      : 'Your personal starting weight was corrected. Your target, weigh-ins, sharing choices and enrollment date are unchanged; refreshing your goal.',
                })
                section.current
                  ?.querySelector<HTMLElement>('#dashboard-goals-title')
                  ?.focus()
                pendingFocus.current = {
                  challengeId: selected.id,
                  control,
                }
                workspace.refresh()
              }}
            />
          )}
        </>
      )}
    </section>
  )
}

function SelectedGoal({
  workspace,
  challengeId,
  onSaved,
}: {
  workspace: PersonalWorkspace
  challengeId: string
  onSaved: (control: 'target' | 'starting-weight') => void
}) {
  const [editing, setEditing] = useState(false)
  const [editingStartingWeight, setEditingStartingWeight] = useState(false)
  const key = `${workspace.ownerKey}:${challengeId}:${workspace.contexts.key}`
  const [history, setHistory] = useState<{
    key: string
    state: 'ready' | 'error'
    rows: ReachedTargetMilestone[]
  } | null>(null)
  const challenge = workspace.contexts.data.challenges.find(
    (row) => row.id === challengeId,
  )!
  const participant = workspace.contexts.data.participants.find(
    (row) =>
      row.challengeId === challengeId &&
      row.userId === workspace.userId &&
      row.status === 'active',
  )
  const goal = participant
    ? ownDashboardGoal(
        challenge,
        participant,
        workspace.userId,
        workspace.personal.data,
        personalWeighInToday(),
      )
    : null
  useEffect(() => {
    let current = true
    if (challenge.kind !== 'group') return
    if (workspace.persistence.mode === 'unavailable') {
      setHistory({ key, state: 'error', rows: [] })
      return
    }
    workspace.persistence.repositories.participants
      .listOwnGroupTargetMilestones(challengeId)
      .then((result) => {
        if (current)
          setHistory({
            key,
            state: result.state === 'error' ? 'error' : 'ready',
            rows: result.state === 'success' ? result.data : [],
          })
      })
      .catch(() => {
        if (current) setHistory({ key, state: 'error', rows: [] })
      })
    return () => {
      current = false
    }
  }, [challengeId, challenge.kind, workspace.persistence, key])
  if (!goal || !participant)
    return (
      <FeedbackPanel tone="empty">
        Your active enrollment could not be verified.
      </FeedbackPanel>
    )
  const { dashboard } = goal
  const canChange =
    Number.isFinite(participant.startingWeightKg) &&
    participant.startingWeightKg > 0 &&
    challenge.kind === 'group' &&
    ['draft', 'active'].includes(challenge.status)
  const canCorrectStartingWeight =
    participant.status === 'active' &&
    Number.isFinite(participant.startingWeightKg) &&
    participant.startingWeightKg > 0
  const currentHistory = history?.key === key ? history : null
  return (
    <Card className="space-y-5 p-5 sm:p-7">
      <h3 className="break-words text-xl font-bold">
        {challenge.name} · your goal
      </h3>
      {challenge.kind === 'group' ? (
        <p className="text-sm text-ink-muted">
          Progress uses only your entries explicitly shared with this group
          since enrollment. Your private chart and notes above remain personal.
        </p>
      ) : null}
      {workspace.personal.state !== 'ready' ? (
        <FeedbackPanel
          tone={workspace.personal.state === 'loading' ? 'loading' : 'error'}
        >
          {workspace.personal.state === 'loading'
            ? 'Loading saved goal evidence…'
            : 'Saved goal evidence could not be loaded. Refresh before changing your target.'}
        </FeedbackPanel>
      ) : (
        <>
          {goal.equalBaseline ? (
            <p role="status">
              Your target equals your original starting weight and is already
              reached at enrollment. No achievement date is inferred.
            </p>
          ) : null}
          {goal.invalidTarget ? (
            <FeedbackPanel tone="error">
              This group target is above your original starting weight. Choose a
              lower target to see progress.
            </FeedbackPanel>
          ) : null}
          <MilestoneProgress
            direction={dashboard.progressState.direction}
            milestones={createParticipantMilestones(dashboard)}
            personalGoal={
              goal.equalBaseline && dashboard.currentWeightKg === null
                ? undefined
                : {
                    currentWeightKg: dashboard.currentWeightKg,
                    remainingWeightKg: dashboard.remainingTargetWeightKg,
                    startingWeightKg: dashboard.startingWeightKg,
                    targetWeightKg: dashboard.targetWeightKg,
                    statusLabel: goal.invalidTarget
                      ? 'Invalid target'
                      : dashboard.targetWeightKg === null
                        ? 'No target set'
                        : dashboard.progressState.state === 'target-reached'
                          ? 'Target reached'
                          : dashboard.currentWeightKg === null
                            ? 'First weigh-in needed'
                            : 'In progress',
                  }
            }
          />
          {goal.equalBaseline && dashboard.currentWeightKg === null ? (
            <p>
              Starting weight: {participant.startingWeightKg} kg · Target:{' '}
              {participant.targetWeightKg} kg
            </p>
          ) : null}
          {canChange ? (
            <Button
              className="min-h-11"
              data-change-target
              variant={goal.reached ? 'primary' : 'secondary'}
              onClick={() => setEditing(true)}
            >
              {goal.reached
                ? 'Target reached · Change target'
                : 'Change target'}
            </Button>
          ) : null}
          {canCorrectStartingWeight ? (
            <Button
              className="min-h-11"
              data-change-starting-weight
              variant="secondary"
              onClick={() => setEditingStartingWeight(true)}
            >
              Edit starting weight
            </Button>
          ) : null}
        </>
      )}
      {challenge.kind === 'group' ? (
        <>
          <h4 className="font-bold">Reached target history</h4>
          {!currentHistory ? (
            <p role="status">Loading reached target history…</p>
          ) : currentHistory.state === 'error' ? (
            <p role="status">
              Reached target history is unavailable right now. Existing
              achievements have not been changed.
            </p>
          ) : currentHistory.rows.length ? (
            <ul className="space-y-2">
              {currentHistory.rows.map((row, index) => (
                <li key={`${row.targetWeightKg}:${row.achievedOn}:${index}`}>
                  {new Intl.NumberFormat(undefined, {
                    maximumFractionDigits: 2,
                  }).format(row.targetWeightKg)}{' '}
                  kg ·{' '}
                  {row.achievedOn ??
                    'Reached at enrollment; no recorded achievement date'}
                </li>
              ))}
            </ul>
          ) : (
            <p>No previous reached targets saved yet.</p>
          )}
          <Link
            className="flex w-fit min-h-11 items-center font-semibold text-forest-800 underline"
            to={`/group?${new URLSearchParams({ challenge: challengeId })}#group-history`}
          >
            Open this group’s shared history and previous-entry changes
          </Link>
        </>
      ) : null}
      {challenge.ownerId === workspace.userId ? (
        <Link
          className="flex w-fit min-h-11 items-center font-semibold text-forest-800 underline"
          to={
            challenge.kind === 'group'
              ? `/challenge/invites?${new URLSearchParams({ challenge: challengeId })}`
              : `/challenge/setup?${new URLSearchParams({ challenge: challengeId })}`
          }
        >
          {challenge.kind === 'group'
            ? 'Manage group invitations'
            : 'Manage this challenge'}
        </Link>
      ) : null}
      {editing && canChange ? (
        <ChangeTargetDialog
          workspace={workspace}
          participant={participant}
          reached={goal.reached}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onSaved('target')
          }}
        />
      ) : null}
      {editingStartingWeight && canCorrectStartingWeight ? (
        <ChangeStartingWeightDialog
          workspace={workspace}
          participant={participant}
          onClose={() => setEditingStartingWeight(false)}
          onSaved={() => {
            setEditingStartingWeight(false)
            onSaved('starting-weight')
          }}
        />
      ) : null}
    </Card>
  )
}

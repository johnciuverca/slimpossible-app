import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useOptionalAuth } from '../auth/useAuth'
import { Button, Card, PageHeader, StatusPill } from '../components/ui'
import { createPersistence } from '../data/persistence'
import { formatChartDate as formatDate } from '../models/chartDate'
import type { Challenge } from '../models/challenge'

type Tab = 'active' | 'archived'
type Snapshot = {
  key: string
  challenges: Challenge[]
  error: string
  loading: boolean
}

function currentDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function statusTone(status: Challenge['status']) {
  if (status === 'active') return 'success'
  return 'neutral'
}

function challengeStatusLabel(status: Challenge['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ChallengeManagementPage() {
  const { state: auth } = useOptionalAuth()
  const ownerId = auth.status === 'signed-in' ? (auth.user.id ?? '') : ''
  const persistence = useMemo(() => createPersistence(auth), [auth])
  const ownerKey = `${auth.status}:${ownerId}:${persistence.mode}`
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: '',
    challenges: [],
    error: '',
    loading: true,
  })
  const [tabState, setTabState] = useState<{ key: string; tab: Tab }>({
    key: ownerKey,
    tab: 'active',
  })
  const [restoreChoice, setRestoreChoice] = useState<{
    key: string
    values: Record<string, 'active' | 'completed' | ''>
  }>({ key: ownerKey, values: {} })
  // Increment on every account transition, including leaving and returning to the same owner.
  const generation = useRef({ key: ownerKey, id: 0 })
  if (generation.current.key !== ownerKey) {
    generation.current = { key: ownerKey, id: generation.current.id + 1 }
  }
  const sessionGeneration = generation.current.id
  const [action, setAction] = useState({
    generation: sessionGeneration,
    savingId: '',
    message: '',
  })
  const savingId =
    action.generation === sessionGeneration ? action.savingId : ''
  const actionMessage =
    action.generation === sessionGeneration ? action.message : ''
  const setSavingId = (savingId: string) =>
    setAction((current) => ({
      ...current,
      generation: sessionGeneration,
      savingId,
    }))
  const setActionMessage = (message: string) =>
    setAction((current) => ({
      ...current,
      generation: sessionGeneration,
      message,
    }))

  const feedbackRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    // Feedback follows the list and may be below the viewport after a card action.
    if (actionMessage) feedbackRef.current?.focus()
  }, [actionMessage])

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setSnapshot({ key: ownerKey, challenges: [], error: '', loading: true })

    async function loadOwnedChallenges() {
      if (!ownerId || persistence.mode === 'unavailable') {
        if (current) {
          setSnapshot({
            key: ownerKey,
            challenges: [],
            error:
              persistence.mode === 'unavailable'
                ? persistence.message
                : 'Sign in to manage challenges you own.',
            loading: false,
          })
        }
        return
      }

      const result = await persistence.repositories.challenges.listOwned(
        ownerId,
        { signal: controller.signal },
      )
      if (!current) return
      if (result.state === 'error') {
        setSnapshot({
          key: ownerKey,
          challenges: [],
          error: 'Your owned challenges could not be loaded. Try refreshing.',
          loading: false,
        })
        return
      }
      setSnapshot({
        key: ownerKey,
        challenges:
          result.state === 'success'
            ? result.data.filter(
                (challenge) =>
                  challenge.ownerId === ownerId && challenge.kind === 'group',
              )
            : [],
        error: '',
        loading: false,
      })
    }

    void loadOwnedChallenges().catch(() => {
      if (current)
        setSnapshot({
          key: ownerKey,
          challenges: [],
          error: 'Your owned challenges could not be loaded. Try refreshing.',
          loading: false,
        })
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [ownerId, ownerKey, persistence, refreshVersion])

  const currentSnapshot = snapshot.key === ownerKey ? snapshot : null
  const challenges = currentSnapshot?.challenges ?? []
  const activeChallenges = challenges.filter(
    (challenge) => challenge.status !== 'archived',
  )
  const archivedChallenges = challenges.filter(
    (challenge) => challenge.status === 'archived',
  )
  const selectedTab = tabState.key === ownerKey ? tabState.tab : 'active'
  const selectedRestoreChoices =
    restoreChoice.key === ownerKey ? restoreChoice.values : {}
  const visibleChallenges =
    selectedTab === 'active' ? activeChallenges : archivedChallenges

  function selectTab(next: Tab) {
    setTabState({ key: ownerKey, tab: next })
    setActionMessage('')
  }

  function setLegacyRestoreChoice(
    challengeId: string,
    value: 'active' | 'completed' | '',
  ) {
    setRestoreChoice((current) => ({
      key: ownerKey,
      values: {
        ...(current.key === ownerKey ? current.values : {}),
        [challengeId]: value,
      },
    }))
  }

  async function transitionChallenge(challenge: Challenge) {
    if (persistence.mode === 'unavailable' || !ownerId) return
    const restoring = challenge.status === 'archived'
    const legacyChoice = selectedRestoreChoices[challenge.id]
    const endDatePassed = challenge.endDate < currentDateOnly()
    if (
      restoring &&
      !challenge.archivedFromStatus &&
      !endDatePassed &&
      !legacyChoice
    ) {
      setActionMessage(`Choose a restore status for ${challenge.name}.`)
      return
    }

    setSavingId(challenge.id)
    setActionMessage('')
    const result = await Promise.resolve()
      .then(() =>
        restoring
          ? persistence.repositories.challenges.restore(
              challenge.id,
              legacyChoice || undefined,
            )
          : persistence.repositories.challenges.archive(challenge.id),
      )
      .catch(() => ({ state: 'error' as const }))
    if (generation.current.id !== sessionGeneration) return
    setSavingId('')

    if (result.state === 'error') {
      setActionMessage(
        restoring
          ? 'This challenge could not be restored. Refresh and check its current status.'
          : 'This challenge could not be archived. Refresh and check its current status.',
      )
      return
    }
    if (result.state === 'empty') {
      setActionMessage(
        'This challenge is no longer available to this account. Refresh the list.',
      )
      return
    }

    setSnapshot((current) => {
      if (
        generation.current.id !== sessionGeneration ||
        current.key !== ownerKey
      )
        return current
      return {
        ...current,
        challenges: current.challenges.map((item) =>
          item.id === result.data.id ? result.data : item,
        ),
      }
    })
    setActionMessage(
      restoring
        ? `${result.data.name} was restored as ${challengeStatusLabel(result.data.status)}. Previous invitation links stay revoked.`
        : `${result.data.name} was archived. Group history remains available to current authorized viewers.`,
    )
    setRestoreChoice((current) => {
      if (
        generation.current.id !== sessionGeneration ||
        current.key !== ownerKey
      )
        return current
      const values = { ...current.values }
      delete values[challenge.id]
      return { key: ownerKey, values }
    })
  }

  return (
    <section aria-labelledby="challenge-management-title" className="w-full">
      <Card className="mx-auto max-w-5xl p-5 sm:p-8">
        <PageHeader
          description="Archive a group challenge to pause new participation while retaining its shared history. Active and completed status stays explicit."
          title="Manage group challenges."
          titleId="challenge-management-title"
        >
          <StatusPill>Owner controls</StatusPill>
        </PageHeader>

        <div
          aria-label="Challenge lifecycle views"
          className="mt-8 grid grid-cols-2 gap-2 rounded-2xl bg-page p-1.5 sm:max-w-md"
          role="tablist"
        >
          {(['active', 'archived'] as const).map((value) => (
            <button
              aria-controls={`challenge-panel-${value}`}
              aria-selected={selectedTab === value}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${selectedTab === value ? 'bg-forest-800 text-white' : 'text-ink-muted hover:bg-panel'}`}
              id={`challenge-tab-${value}`}
              key={value}
              onClick={() => selectTab(value)}
              role="tab"
              type="button"
            >
              {value === 'active' ? 'Active' : 'Archived'}{' '}
              <span
                aria-label={`${value === 'active' ? activeChallenges.length : archivedChallenges.length} challenges`}
              >
                (
                {value === 'active'
                  ? activeChallenges.length
                  : archivedChallenges.length}
                )
              </span>
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`challenge-tab-${selectedTab}`}
          className="mt-6 space-y-4"
          id={`challenge-panel-${selectedTab}`}
          role="tabpanel"
          tabIndex={0}
        >
          {currentSnapshot === null || currentSnapshot.loading ? (
            <p role="status" className="py-8 text-sm text-ink-muted">
              Loading your owned group challenges…
            </p>
          ) : currentSnapshot.error ? (
            <div className="space-y-4 py-6">
              <p role="alert" className="text-sm text-danger-800">
                {currentSnapshot.error}
              </p>
              <Button
                onClick={() => setRefreshVersion((value) => value + 1)}
                variant="secondary"
              >
                Try again
              </Button>
            </div>
          ) : visibleChallenges.length === 0 ? (
            <div className="rounded-2xl border border-line bg-page p-6">
              <h2 className="text-lg font-bold text-ink">
                {selectedTab === 'active'
                  ? 'No active or unarchived group challenges yet.'
                  : 'No archived group challenges.'}
              </h2>
              {selectedTab === 'active' ? (
                <Link
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
                  to="/challenge/setup?kind=group"
                >
                  Create a group challenge
                </Link>
              ) : null}
            </div>
          ) : (
            visibleChallenges.map((challenge) => {
              const archived = challenge.status === 'archived'
              const endDatePassed = challenge.endDate < currentDateOnly()
              const restoredStatus = endDatePassed
                ? 'completed'
                : challenge.archivedFromStatus === 'draft'
                  ? 'active'
                  : challenge.archivedFromStatus
              const needsLegacyChoice = archived && !restoredStatus
              const chosenLegacyStatus =
                selectedRestoreChoices[challenge.id] ?? ''
              return (
                <article
                  aria-labelledby={`challenge-name-${challenge.id}`}
                  className="rounded-2xl border border-line bg-panel p-4 sm:p-6"
                  key={challenge.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className="text-lg font-bold text-ink"
                          id={`challenge-name-${challenge.id}`}
                        >
                          {challenge.name}
                        </h2>
                        <StatusPill
                          className="px-3 py-1 text-xs"
                          tone={
                            archived ? 'neutral' : statusTone(challenge.status)
                          }
                        >
                          {challengeStatusLabel(challenge.status)}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-ink-muted">
                        {formatDate(challenge.startDate)} –{' '}
                        {formatDate(challenge.endDate)}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-ink-muted">
                        {archived
                          ? 'Shared history remains available to current authorized viewers. Existing invitations stay revoked.'
                          : challenge.status === 'completed'
                            ? 'Completed challenges remain completed when archived or restored after their end date.'
                            : 'Archiving pauses new participation, invitations, group writes, and share changes.'}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-36">
                      {archived ? (
                        <>
                          <Link
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-page"
                            to={`/group?challenge=${encodeURIComponent(challenge.id)}`}
                          >
                            View history
                          </Link>
                          {needsLegacyChoice ? (
                            <label className="text-xs font-semibold text-ink-muted">
                              Original status not recorded. Choose a safe
                              restore status.
                              <select
                                aria-label={`Restore status for ${challenge.name}`}
                                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink"
                                onChange={(event) =>
                                  setLegacyRestoreChoice(
                                    challenge.id,
                                    event.target.value as
                                      'active' | 'completed' | '',
                                  )
                                }
                                value={chosenLegacyStatus}
                              >
                                <option value="">Choose status</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                              </select>
                            </label>
                          ) : (
                            <p className="text-xs text-ink-muted">
                              Restores as{' '}
                              {challengeStatusLabel(restoredStatus!)}
                              {endDatePassed
                                ? ' because the end date has passed.'
                                : '.'}
                            </p>
                          )}
                          <Button
                            disabled={Boolean(savingId)}
                            onClick={() => void transitionChallenge(challenge)}
                            variant="secondary"
                          >
                            {savingId === challenge.id
                              ? 'Restoring…'
                              : needsLegacyChoice && !chosenLegacyStatus
                                ? 'Choose status'
                                : `Restore${needsLegacyChoice ? ` as ${challengeStatusLabel(chosenLegacyStatus as Challenge['status'])}` : ''}`}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-page"
                            to={`/challenge/setup?challenge=${encodeURIComponent(challenge.id)}`}
                          >
                            Edit challenge
                          </Link>
                          <Button
                            disabled={Boolean(savingId)}
                            onClick={() => void transitionChallenge(challenge)}
                            variant="secondary"
                          >
                            {savingId === challenge.id
                              ? 'Archiving…'
                              : 'Archive'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <p
          aria-atomic="true"
          aria-live="polite"
          className={
            actionMessage
              ? 'mt-5 rounded-xl text-sm text-ink-muted focus:outline-2 focus:outline-offset-4 focus:outline-forest-700'
              : ''
          }
          ref={feedbackRef}
          role="status"
          tabIndex={-1}
        >
          {actionMessage}
        </p>

        <aside className="mt-8 rounded-2xl border border-line bg-page p-4 sm:p-5">
          <p className="font-semibold text-ink">
            Personal records remain separate.
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Everyone can continue to edit their own personal weigh-ins. This
            page changes only the group challenge lifecycle.
          </p>
        </aside>

        <Link
          className="mt-6 inline-block text-sm font-semibold text-forest-800 underline"
          to="/group"
        >
          Back to Group
        </Link>
      </Card>
    </section>
  )
}

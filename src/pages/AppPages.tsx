import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  Card,
  FeedbackPanel,
  PageHeader,
  ProgressBar,
  StatusPill,
  type FeedbackTone,
} from '../components/ui'
import { MilestoneProgress } from '../components/MilestoneProgress'
import type { ParticipantMilestones } from '../models/participantMilestones'
import { createParticipantMilestones } from '../models/participantMilestones'
import {
  reconcileMilestoneCelebration,
  reconcileWeeklyWinCelebration,
} from '../models/progressCelebrations'
import {
  createParticipantDashboardFlow,
  type ParticipantDashboardFlow,
} from '../models/participantDashboardFlow'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'
import type { Participant } from '../models/participant'
import type { WeighIn } from '../models/weighIn'
import {
  mostRecentSunday,
  type GroupProgressSummary,
} from '../models/groupProgress'
import {
  localDateOnly,
  type ProvisionalGroupLeaderSummary,
} from '../models/provisionalGroupLeader'
import { createSavedWeeklyWinCelebration } from '../models/weeklyCelebrations'

type PlaceholderPageProps = {
  children?: ReactNode
  description: string
  title: string
}

const milestonePreview: ParticipantMilestones = {
  challengeId: 'local-preview',
  completionPercentage: 50,
  milestones: [
    {
      id: 'local-preview:participant-preview:25',
      state: 'reached',
      thresholdPercentage: 25,
    },
    {
      id: 'local-preview:participant-preview:50',
      state: 'reached',
      thresholdPercentage: 50,
    },
    {
      id: 'local-preview:participant-preview:75',
      state: 'upcoming',
      thresholdPercentage: 75,
    },
    {
      id: 'local-preview:participant-preview:100',
      state: 'upcoming',
      thresholdPercentage: 100,
    },
  ],
  participantId: 'participant-preview',
  state: 'available',
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

type PersonalDashboardData = {
  challenge: Challenge
  flow: ParticipantDashboardFlow
  participant: Participant
  viewerId: string
  weighIns: WeighIn[]
}

type GroupDashboardData = {
  challenge: Challenge
  summary: GroupProgressSummary
}

function usePersonalDashboard() {
  const { state: authState } = useOptionalAuth()
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const ownerId = authState.user?.id
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [data, setData] = useState<PersonalDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(authState.status === 'signed-in')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<FeedbackTone>('info')
  const [isMissingChallenge, setIsMissingChallenge] = useState(false)
  const [isMissingMembership, setIsMissingMembership] = useState(false)
  const [enrollmentChallengeId, setEnrollmentChallengeId] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadDashboard() {
      setIsMissingChallenge(false)
      setIsMissingMembership(false)
      setEnrollmentChallengeId('')
      if (authState.status !== 'signed-in' || !ownerId) {
        setData(null)
        setMessage('Sign in to view your saved dashboard.')
        setMessageTone('info')
        setIsLoading(false)
        return
      }
      if (persistence.mode === 'unavailable') {
        setData(null)
        setMessage(persistence.message)
        setMessageTone('info')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessageTone('info')
      const challenges =
        await persistence.repositories.challenges.listVisibleToUser(ownerId)
      if (!isCurrent) return
      if (challenges.state === 'error') {
        setData(null)
        setMessage(challenges.error.message)
        setMessageTone('error')
        setIsLoading(false)
        return
      }
      const savedChallenges =
        challenges.state === 'success' ? challenges.data : []
      const challenge = challengeParam
        ? savedChallenges.find(({ id }) => id === challengeParam)
        : savedChallenges[0]
      if (!challenge) {
        setData(null)
        setMessage(
          savedChallenges.length === 0
            ? 'Set up a challenge before viewing your dashboard.'
            : challengeParam
              ? 'The selected challenge is unavailable for this account.'
              : 'Set up a challenge before viewing your dashboard.',
        )
        setIsMissingChallenge(savedChallenges.length === 0)
        setMessageTone('empty')
        setIsLoading(false)
        return
      }

      const participants =
        await persistence.repositories.participants.listForUser(ownerId)
      if (!isCurrent) return
      if (participants.state === 'error') {
        setData(null)
        setMessage(participants.error.message)
        setMessageTone('error')
        setIsLoading(false)
        return
      }
      const participantRows =
        participants.state === 'success' ? participants.data : []
      const participant = participantRows.find(
        (candidate) =>
          candidate.challengeId === challenge.id &&
          candidate.status === 'active',
      )
      if (!participant) {
        setData(null)
        setEnrollmentChallengeId(challenge.id)
        setIsMissingMembership(true)
        setMessage(
          'Enroll yourself in the selected challenge before viewing your dashboard.',
        )
        setMessageTone('info')
        setIsLoading(false)
        return
      }

      const weighIns =
        await persistence.repositories.weighIns.listForParticipant(
          participant.id,
        )
      if (!isCurrent) return
      if (weighIns.state === 'error') {
        setData(null)
        setMessage(weighIns.error.message)
        setMessageTone('error')
        setIsLoading(false)
        return
      }
      const records = weighIns.state === 'success' ? weighIns.data : []
      setData({
        challenge,
        flow: createParticipantDashboardFlow({
          challenge,
          participantId: participant.id,
          participants: [participant],
          weighIns: records,
        }),
        participant,
        viewerId: ownerId,
        weighIns: records,
      })
      setMessage('')
      setMessageTone('info')
      setIsLoading(false)
    }

    void loadDashboard()
    return () => {
      isCurrent = false
    }
  }, [authState.status, challengeParam, ownerId, persistence])

  return {
    data,
    enrollmentChallengeId,
    isLoading,
    isMissingChallenge,
    isMissingMembership,
    message,
    messageTone,
  }
}

function DashboardState({
  children,
  isLoading,
  message,
  messageContent,
  messageTone = 'info',
}: {
  children: ReactNode
  isLoading: boolean
  message: string
  messageContent?: ReactNode
  messageTone?: FeedbackTone
}) {
  if (isLoading) {
    return (
      <FeedbackPanel className="mt-8" tone="loading">
        Loading your saved dashboard…
      </FeedbackPanel>
    )
  }
  if (message) {
    if (messageContent) return <>{messageContent}</>
    return (
      <FeedbackPanel className="mt-8" tone={messageTone}>
        {message}
      </FeedbackPanel>
    )
  }
  return <>{children}</>
}

export function HomePage() {
  const { state: authState } = useOptionalAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const ownerId = authState.user?.id
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [overview, setOverview] = useState<{
    challengeId: string
    personalFlow: ParticipantDashboardFlow | null
    personalError: boolean
    groupSummary: GroupProgressSummary | null
    groupError: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(authState.status === 'signed-in')
  const [isOverviewLoading, setIsOverviewLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadChallenges() {
      if (authState.status !== 'signed-in' || !ownerId) {
        setChallenges([])
        setParticipants([])
        setOverview(null)
        setIsLoading(false)
        setLoadError('')
        return
      }

      if (persistence.mode === 'unavailable') {
        setChallenges([])
        setParticipants([])
        setOverview(null)
        setLoadError(persistence.message)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError('')
      const [challengeResult, participantResult] = await Promise.all([
        persistence.repositories.challenges.listVisibleToUser(ownerId),
        persistence.repositories.participants.listForUser(ownerId),
      ])
      if (!isCurrent) return

      if (
        challengeResult.state === 'error' ||
        participantResult.state === 'error'
      ) {
        setLoadError('Your challenges could not be loaded. Try refreshing.')
        setChallenges([])
        setParticipants([])
      } else {
        setChallenges(
          challengeResult.state === 'success' ? challengeResult.data : [],
        )
        setParticipants(
          participantResult.state === 'success' ? participantResult.data : [],
        )
      }
      setIsLoading(false)
    }

    void loadChallenges()
    return () => {
      isCurrent = false
    }
  }, [authState.status, ownerId, persistence])

  const selectedChallenge =
    challenges.find(({ id }) => id === challengeParam) ?? challenges[0] ?? null
  const activeParticipant = selectedChallenge
    ? (participants.find(
        (participant) =>
          participant.challengeId === selectedChallenge.id &&
          participant.status === 'active',
      ) ?? null)
    : null

  useEffect(() => {
    if (isLoading || authState.status !== 'signed-in') return
    const nextParams = new URLSearchParams(searchParams)

    if (!challenges.length) {
      if (nextParams.has('challenge')) {
        nextParams.delete('challenge')
        setSearchParams(nextParams, { replace: true })
      }
      return
    }

    if (!challenges.some(({ id }) => id === challengeParam)) {
      nextParams.set('challenge', challenges[0].id)
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    authState.status,
    challengeParam,
    challenges,
    isLoading,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    let isCurrent = true

    async function loadOverview() {
      setOverview(null)
      setIsOverviewLoading(false)
      if (
        isLoading ||
        !selectedChallenge ||
        !activeParticipant ||
        persistence.mode === 'unavailable'
      ) {
        return
      }

      setIsOverviewLoading(true)
      try {
        const [weighIns, groupResult] = await Promise.all([
          persistence.repositories.weighIns.listForParticipant(
            activeParticipant.id,
          ),
          persistence.repositories.groupProgress.getForChallenge(
            selectedChallenge.id,
            mostRecentSunday(),
          ),
        ])
        if (!isCurrent) return

        setOverview({
          challengeId: selectedChallenge.id,
          groupError: groupResult.state === 'error',
          groupSummary:
            groupResult.state === 'success' ? groupResult.data : null,
          personalError: weighIns.state === 'error',
          personalFlow:
            weighIns.state === 'error'
              ? null
              : createParticipantDashboardFlow({
                  challenge: selectedChallenge,
                  participantId: activeParticipant.id,
                  participants: [activeParticipant],
                  weighIns: weighIns.state === 'success' ? weighIns.data : [],
                }),
        })
      } catch {
        if (!isCurrent) return
        setOverview({
          challengeId: selectedChallenge.id,
          groupError: true,
          groupSummary: null,
          personalError: true,
          personalFlow: null,
        })
      } finally {
        if (isCurrent) setIsOverviewLoading(false)
      }
    }

    void loadOverview()
    return () => {
      isCurrent = false
    }
  }, [activeParticipant, isLoading, persistence, selectedChallenge])

  function selectChallenge(challengeId: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('challenge', challengeId)
    setSearchParams(nextParams)
  }

  if (authState.status === 'loading') {
    return (
      <section
        className="mx-auto w-full max-w-6xl"
        aria-labelledby="home-title"
      >
        <h1 className="sr-only" id="home-title">
          Overview
        </h1>
        <FeedbackPanel className="w-full" tone="loading">
          Checking your saved session…
        </FeedbackPanel>
      </section>
    )
  }

  if (authState.status !== 'signed-in') {
    return (
      <section
        className="mx-auto w-full max-w-6xl"
        aria-labelledby="home-title"
      >
        <Card className="grid overflow-hidden p-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
              A steadier way forward
            </p>
            <h1
              className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
              id="home-title"
            >
              Keep showing up. It adds up.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">
              Follow your own progress and, when you choose, see a permitted
              group summary.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-11 items-center rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                to="/register"
              >
                Create your account
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 py-3 text-sm font-bold text-forest-800 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                to="/login"
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="flex min-h-52 items-center bg-forest-800 p-7 text-white sm:p-10 lg:p-12">
            <p className="max-w-sm text-lg leading-7 text-forest-50">
              Personal weigh-ins stay in your view. Only authorized, shared
              summaries appear with a group.
            </p>
          </div>
        </Card>
      </section>
    )
  }

  if (isLoading) {
    return (
      <section
        className="mx-auto w-full max-w-6xl"
        aria-labelledby="home-title"
      >
        <h1 className="sr-only" id="home-title">
          Overview
        </h1>
        <FeedbackPanel className="w-full" tone="loading">
          Loading your saved challenges…
        </FeedbackPanel>
      </section>
    )
  }

  if (loadError) {
    return (
      <section
        className="mx-auto w-full max-w-6xl"
        aria-labelledby="home-title"
      >
        <h1 className="sr-only" id="home-title">
          Overview
        </h1>
        <FeedbackPanel className="w-full" tone="error">
          {loadError}
        </FeedbackPanel>
      </section>
    )
  }

  const isOwner = selectedChallenge?.ownerId === ownerId
  const isActiveMember = Boolean(activeParticipant)
  const challengeQuery = selectedChallenge
    ? `?challenge=${encodeURIComponent(selectedChallenge.id)}`
    : ''
  const currentOverview =
    overview?.challengeId === selectedChallenge?.id ? overview : null
  const personalDashboard = currentOverview?.personalFlow?.dashboard ?? null
  const latestWeighIn = personalDashboard?.latestWeighIn
  const groupSummary = currentOverview?.groupSummary ?? null
  const panelClass =
    'rounded-panel border border-line/80 bg-panel p-5 shadow-panel sm:p-6'

  function formatWeight(weight: number) {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(weight)} kg`
  }

  function formatChange(change: number) {
    const sign = change > 0 ? '+' : change < 0 ? '−' : ''
    return `${sign}${formatWeight(Math.abs(change))}`
  }

  function formatDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsedDate.getTime())
      ? date
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
          parsedDate,
        )
  }

  const availableActions: [string, string][] = isActiveMember
    ? [
        ['Today', `/today${challengeQuery}`],
        ['My progress', `/progress${challengeQuery}`],
        ['Group progress', `/group${challengeQuery}`],
        ['Goals', `/goals${challengeQuery}`],
        ['Record a weigh-in', `/weigh-ins${challengeQuery}`],
      ]
    : isOwner && selectedChallenge
      ? [
          [
            'Enroll yourself',
            `/challenge/participants/enroll?challenge=${encodeURIComponent(selectedChallenge.id)}&self=owner`,
          ],
          ['Invite participants', `/challenge/invites${challengeQuery}`],
        ]
      : []

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-8"
      aria-labelledby="home-title"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="flex flex-col justify-between gap-8 overflow-hidden bg-forest-800 p-7 text-white sm:p-10 lg:p-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-100">
              {selectedChallenge ? 'Your challenge' : 'Your overview'}
            </p>
            <h1
              className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
              id="home-title"
            >
              Keep showing up. It adds up.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-forest-50">
              {selectedChallenge
                ? 'Your personal progress stays yours. Shared group information appears only when your membership allows it.'
                : 'Set up a challenge or join one with an invitation to see your saved progress here.'}
            </p>
          </div>
          {!selectedChallenge ? (
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-forest-900 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                to="/challenge/setup"
              >
                Set up a challenge
              </Link>
            </div>
          ) : null}
        </Card>

        <article className={panelClass} aria-labelledby="latest-entry-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
            Private view
          </p>
          <h2 className="mt-2 text-lg font-bold" id="latest-entry-title">
            Your latest weigh-in
          </h2>
          {isOverviewLoading ? (
            <p className="mt-5 text-sm text-ink-muted" role="status">
              Loading your saved entry…
            </p>
          ) : latestWeighIn ? (
            <>
              <p className="mt-4 text-4xl font-extrabold tracking-tight">
                {formatWeight(latestWeighIn.weightKg)}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {formatDate(latestWeighIn.date)} · visible only in your personal
                view
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink-muted">
              {isActiveMember
                ? currentOverview?.personalError
                  ? 'Your personal entry is unavailable right now.'
                  : 'No weigh-ins are saved for this challenge yet.'
                : selectedChallenge
                  ? 'Enroll as a participant to see your personal entries.'
                  : 'Your saved weigh-ins will appear after you join a challenge.'}
            </p>
          )}
          {latestWeighIn?.note ? (
            <p className="mt-4 rounded-xl bg-page p-3 text-sm text-ink-muted">
              Your personal note is private and is not shown on this overview.
            </p>
          ) : null}
        </article>
      </div>

      {challenges.length ? (
        <section aria-labelledby="challenge-picker-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                Your challenges
              </p>
              <h2
                className="mt-1 text-xl font-bold"
                id="challenge-picker-title"
              >
                Choose what to view
              </h2>
            </div>
            {isOwner ? (
              <Link
                className="text-sm font-semibold text-forest-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                to="/challenge/setup"
              >
                Set up another challenge
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {challenges.map((challenge) => {
              const isSelected = challenge.id === selectedChallenge?.id
              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-h-24 rounded-panel border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${isSelected ? 'border-forest-700 bg-forest-50 shadow-panel' : 'border-line bg-panel hover:bg-page'}`}
                  key={challenge.id}
                  onClick={() => selectChallenge(challenge.id)}
                  type="button"
                >
                  <span className="block text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {challenge.ownerId === ownerId
                      ? 'Challenge owner'
                      : 'Joined challenge'}
                    {isSelected ? ' · Selected' : ''}
                  </span>
                  <span className="mt-2 block text-base font-bold text-ink">
                    {challenge.name}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <FeedbackPanel className="w-full" tone="empty">
          No saved challenge is available for this account yet. Set up a
          challenge or join one with an invitation.
        </FeedbackPanel>
      )}

      {selectedChallenge ? (
        <>
          {isActiveMember ? (
            <section aria-labelledby="snapshot-title">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Saved records only
                </p>
                <h2 className="mt-1 text-xl font-bold" id="snapshot-title">
                  Your snapshot
                </h2>
              </div>
              {isOverviewLoading ? (
                <FeedbackPanel className="w-full" tone="loading">
                  Loading authorized progress summaries…
                </FeedbackPanel>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  <article className={panelClass}>
                    <p className="text-sm font-semibold text-ink-muted">
                      Personal target progress
                    </p>
                    <p className="mt-3 text-3xl font-extrabold">
                      {personalDashboard?.completionPercentage == null
                        ? '—'
                        : `${Math.round(personalDashboard.completionPercentage)}%`}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                      {personalDashboard?.completionPercentage == null
                        ? 'A saved starting weight, target, and weigh-in are needed for this measure.'
                        : 'Calculated from your own saved records.'}
                    </p>
                  </article>
                  <article className={panelClass}>
                    <p className="text-sm font-semibold text-ink-muted">
                      Since your previous entry
                    </p>
                    <p className="mt-3 text-3xl font-extrabold">
                      {personalDashboard?.dailyChangeKg == null
                        ? '—'
                        : formatChange(personalDashboard.dailyChangeKg)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                      {personalDashboard?.dailyChangeKg == null
                        ? 'A comparison appears after two weigh-ins are saved.'
                        : 'Difference between your two most recent saved entries.'}
                    </p>
                  </article>
                  <article className={panelClass}>
                    <p className="text-sm font-semibold text-ink-muted">
                      Weekly group comparison
                    </p>
                    <p className="mt-3 text-3xl font-extrabold">
                      {currentOverview?.groupError
                        ? '—'
                        : groupSummary
                          ? `${groupSummary.eligibleParticipantCount} / ${groupSummary.activeParticipantCount}`
                          : '—'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                      {currentOverview?.groupError
                        ? 'The authorized group summary is unavailable right now.'
                        : groupSummary
                          ? `Eligible participants · ${groupSummary.previousSunday} to ${groupSummary.currentSunday}.`
                          : 'No authorized group summary is available yet.'}
                    </p>
                  </article>
                </div>
              )}
            </section>
          ) : (
            <FeedbackPanel className="w-full" tone="info">
              {isOwner
                ? 'Enroll yourself to view personal and member summaries. You can still invite participants as the owner.'
                : 'Personal and group summaries are available after you join this challenge.'}
            </FeedbackPanel>
          )}

          {availableActions.length ? (
            <section aria-labelledby="actions-title">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Continue
                </p>
                <h2 className="mt-1 text-xl font-bold" id="actions-title">
                  Challenge actions
                </h2>
              </div>
              <nav aria-label="Selected challenge actions">
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {availableActions.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        className="inline-flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm font-bold text-forest-800 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
                        to={href}
                      >
                        {label}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                  {isActiveMember ? (
                    <li>
                      <button
                        aria-label="Group history, coming soon"
                        className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-line bg-page px-4 py-3 text-left text-sm font-semibold text-ink-muted opacity-70"
                        disabled
                        type="button"
                      >
                        Group history
                        <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
                          Coming soon
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              </nav>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export function TodayPage() {
  const {
    data,
    enrollmentChallengeId,
    isLoading,
    isMissingChallenge,
    isMissingMembership,
    message,
  } = usePersonalDashboard()
  const challengeQuery = data
    ? `?challenge=${encodeURIComponent(data.challenge.id)}`
    : ''

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="today-title">
      <Card className="p-8 sm:p-12">
        <PageHeader
          description="Your saved weigh-ins and current challenge status."
          title="Today"
          titleId="today-title"
        >
          <StatusPill>
            {data?.challenge.name ?? 'Personal dashboard'}
          </StatusPill>
        </PageHeader>
        <DashboardState
          isLoading={isLoading}
          message={message}
          messageContent={
            isMissingChallenge ? (
              <div className="mt-8 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  No challenge yet
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  There is no saved challenge for this account yet. Set one up
                  to start tracking your progress.
                </p>
                <Link
                  className="inline-block rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  to="/challenge/setup"
                >
                  Set up a challenge
                </Link>
              </div>
            ) : isMissingMembership && enrollmentChallengeId ? (
              <div className="mt-8 space-y-4">
                <p
                  aria-live="polite"
                  className="text-sm leading-6 text-slate-600"
                  role="status"
                >
                  {message}
                </p>
                <Link
                  className="inline-block rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  to={`/challenge/participants/enroll?challenge=${encodeURIComponent(enrollmentChallengeId)}`}
                >
                  Enroll yourself
                </Link>
              </div>
            ) : undefined
          }
        >
          {data ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Card className="border border-stone-200 p-5 shadow-none">
                <p className="text-sm text-slate-600">Current weight</p>
                <p className="mt-2 text-2xl font-bold">
                  {data.flow.dashboard.currentWeightKg ?? '—'} kg
                </p>
              </Card>
              <Card className="border border-stone-200 p-5 shadow-none">
                <p className="text-sm text-slate-600">Starting weight</p>
                <p className="mt-2 text-2xl font-bold">
                  {data.flow.dashboard.startingWeightKg ?? '—'} kg
                </p>
              </Card>
              <Card className="border border-stone-200 p-5 shadow-none">
                <p className="text-sm text-slate-600">Target weight</p>
                <p className="mt-2 text-2xl font-bold">
                  {data.flow.dashboard.targetWeightKg ?? '—'} kg
                </p>
              </Card>
              <div className="sm:col-span-3">
                <p className="text-sm leading-6 text-slate-600">
                  {data.flow.progressSummary.message}
                </p>
                <Link
                  className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline"
                  to={`/weigh-ins${challengeQuery}`}
                >
                  Record a weigh-in
                </Link>
              </div>
            </div>
          ) : null}
        </DashboardState>
      </Card>
    </section>
  )
}

export function GroupDashboardPage() {
  const { state: authState } = useOptionalAuth()
  const ownerId = authState.user?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [data, setData] = useState<GroupDashboardData | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isLoading, setIsLoading] = useState(authState.status === 'signed-in')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<FeedbackTone>('info')
  const [reloadKey, setReloadKey] = useState(0)
  const [weeklyAnnouncement, setWeeklyAnnouncement] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadGroupDashboard() {
      if (authState.status !== 'signed-in' || !ownerId) {
        setData(null)
        setChallenges([])
        setMessage(
          'Sign in as an active challenge member to view group progress.',
        )
        setMessageTone('info')
        setIsLoading(false)
        return
      }
      if (persistence.mode === 'unavailable') {
        setData(null)
        setChallenges([])
        setMessage('Shared group progress requires a signed-in server session.')
        setMessageTone('info')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessage('')
      setMessageTone('info')
      const challengeResult =
        await persistence.repositories.challenges.listVisibleToUser(ownerId)
      if (!isCurrent) return
      if (challengeResult.state === 'error') {
        setData(null)
        setChallenges([])
        setMessage('Unable to load the selected group challenge.')
        setMessageTone('error')
        setIsLoading(false)
        return
      }

      const visibleChallenges =
        challengeResult.state === 'success' ? challengeResult.data : []
      setChallenges(visibleChallenges)
      const challenge = challengeParam
        ? visibleChallenges.find(({ id }) => id === challengeParam)
        : visibleChallenges[0]
      if (!challenge) {
        setData(null)
        setMessage(
          visibleChallenges.length === 0
            ? 'No challenge is available for this account.'
            : 'The selected challenge is unavailable for this account.',
        )
        setMessageTone('empty')
        setIsLoading(false)
        return
      }

      const result =
        await persistence.repositories.groupProgress.getForChallenge(
          challenge.id,
          mostRecentSunday(),
        )
      if (!isCurrent) return
      if (result.state !== 'success') {
        setData(null)
        setWeeklyAnnouncement('')
        setMessage(
          'Shared progress is available to active members only, or could not be loaded. Try refreshing.',
        )
        setMessageTone('error')
      } else {
        const weeklyCelebration = createSavedWeeklyWinCelebration(result.data)
        setData({ challenge, summary: result.data })
        setWeeklyAnnouncement(
          reconcileWeeklyWinCelebration(ownerId, weeklyCelebration),
        )
        setMessage('')
        setMessageTone('info')
      }
      setIsLoading(false)
    }

    void loadGroupDashboard()
    return () => {
      isCurrent = false
    }
  }, [authState.status, challengeParam, ownerId, persistence, reloadKey])

  const summary = data?.summary
  const weeklyCelebration = summary
    ? createSavedWeeklyWinCelebration(summary)
    : null
  const challengeQuery = data
    ? `?challenge=${encodeURIComponent(data.challenge.id)}`
    : ''

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="group-title">
      <Card className="p-8 sm:p-12">
        <PageHeader
          description="Shared group progress and weekly winners. Individual weigh-in histories and private notes stay private."
          title="Group dashboard"
          titleId="group-title"
        >
          <StatusPill>{data?.challenge.name ?? 'Shared progress'}</StatusPill>
        </PageHeader>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          {data ? (
            <label className="min-w-56 flex-1 text-sm font-semibold text-slate-700">
              Selected challenge
              <select
                className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  const nextParams = new URLSearchParams(searchParams)
                  nextParams.set('challenge', event.target.value)
                  setSearchParams(nextParams)
                }}
                value={data.challenge.id}
              >
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            onClick={() => setReloadKey((value) => value + 1)}
            type="button"
          >
            Refresh shared progress
          </button>
        </div>
        <DashboardState
          isLoading={isLoading}
          message={message}
          messageTone={messageTone}
        >
          {summary ? (
            <div className="mt-8 space-y-8">
              <section aria-labelledby="group-progress-heading">
                <h2 className="text-xl font-bold" id="group-progress-heading">
                  Group progress
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {summary.participantsWithRecordedWeightCount} of{' '}
                  {summary.activeParticipantCount} active participants have a
                  recorded weigh-in. These are aggregate counts only.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <Card className="border border-stone-200 p-5 shadow-none">
                    <p className="text-sm text-slate-600">Active members</p>
                    <p className="mt-2 text-2xl font-bold">
                      {summary.activeParticipantCount}
                    </p>
                  </Card>
                  <Card className="border border-stone-200 p-5 shadow-none">
                    <p className="text-sm text-slate-600">
                      Average goal progress
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {summary.averageCompletionPercentage === null
                        ? '—'
                        : `${summary.averageCompletionPercentage}%`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Across {summary.participantsWithProgressCount} members
                      with a recorded weight
                    </p>
                  </Card>
                  <Card className="border border-stone-200 p-5 shadow-none">
                    <p className="text-sm text-slate-600">Goals reached</p>
                    <p className="mt-2 text-2xl font-bold">
                      {summary.reachedTargetCount}
                    </p>
                  </Card>
                </div>
              </section>

              <section
                aria-labelledby="weekly-winners-heading"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
              >
                <h2 className="text-xl font-bold" id="weekly-winners-heading">
                  Weekly winners
                </h2>
                <p className="mt-2 text-sm text-slate-700">
                  Based on consecutive Sunday weigh-ins:{' '}
                  {summary.previousSunday} to {summary.currentSunday}.
                </p>
                {weeklyAnnouncement ? (
                  <p aria-live="polite" className="sr-only" role="status">
                    {weeklyAnnouncement}
                  </p>
                ) : null}
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  {weeklyCelebration?.state === 'shared-winners'
                    ? 'Shared weekly winners'
                    : weeklyCelebration?.state === 'single-winner'
                      ? 'Weekly winner'
                      : 'Weekly result'}
                </p>
                <p className="mt-4 text-sm text-slate-700">
                  {weeklyCelebration?.message}
                </p>
                {weeklyCelebration &&
                weeklyCelebration.state !== 'no-eligible-candidates' ? (
                  <ul className="mt-2 list-inside list-disc text-slate-800">
                    {weeklyCelebration.winnerNames.map((name, index) => (
                      <li key={`${name}-${index}`}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <p className="text-xs leading-5 text-slate-500">
                Winner results are recalculated from saved Sunday entries
                whenever this view refreshes. Private notes and individual
                weigh-in histories are not included in the group response.
              </p>
              <Link
                className="inline-block text-sm font-semibold text-emerald-700 underline"
                to={`/challenge/invites${challengeQuery}`}
              >
                Invite participants
              </Link>
            </div>
          ) : null}
        </DashboardState>
      </Card>
    </section>
  )
}

export function ProgressPage() {
  const { data, isLoading, message, messageTone } = usePersonalDashboard()
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [provisionalSummary, setProvisionalSummary] =
    useState<ProvisionalGroupLeaderSummary | null>(null)
  const [provisionalMessage, setProvisionalMessage] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setProvisionalSummary(null)
    setProvisionalMessage('')
    if (!data || persistence.mode !== 'remote') return

    persistence.repositories.groupProgress
      .getProvisionalLeader(data.challenge.id, localDateOnly())
      .then((result) => {
        if (!isCurrent) return
        if (result.state === 'success') setProvisionalSummary(result.data)
        else if (result.state === 'error') {
          setProvisionalMessage(
            'Provisional group progress is unavailable right now.',
          )
        }
      })
      .catch(() => {
        if (isCurrent) {
          setProvisionalMessage(
            'Provisional group progress is unavailable right now.',
          )
        }
      })

    return () => {
      isCurrent = false
    }
  }, [data, persistence, refreshVersion])

  return (
    <section
      className="mx-auto w-full max-w-4xl"
      aria-labelledby="progress-title"
    >
      <Card className="p-8 sm:p-12">
        <PageHeader
          description="Your saved history and trend for the selected challenge."
          title="Progress"
          titleId="progress-title"
        >
          <StatusPill>
            {data?.challenge.name ?? 'Personal dashboard'}
          </StatusPill>
        </PageHeader>
        <DashboardState
          isLoading={isLoading}
          message={message}
          messageTone={messageTone}
        >
          {data ? (
            <div className="mt-8 space-y-6">
              {persistence.mode === 'remote' &&
              provisionalSummary?.state !== 'solo-challenge' ? (
                <section
                  aria-labelledby="provisional-leader-title"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="text-lg font-bold"
                        id="provisional-leader-title"
                      >
                        This week’s provisional leader
                      </h2>
                      {provisionalSummary ? (
                        <p className="mt-1 text-sm text-slate-600">
                          Comparing saved check-ins since{' '}
                          {provisionalSummary.previousSunday}; current week{' '}
                          {provisionalSummary.currentWeekStart}–
                          {provisionalSummary.currentWeekEnd}.
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="text-sm font-semibold text-emerald-800 underline"
                      onClick={() =>
                        setRefreshVersion((version) => version + 1)
                      }
                      type="button"
                    >
                      Refresh
                    </button>
                  </div>
                  {provisionalSummary?.state === 'leaders' ? (
                    <>
                      <ul className="mt-3 list-inside list-disc text-slate-800">
                        {provisionalSummary.leaderNames.map((name, index) => (
                          <li key={`${name}-${index}`}>
                            {name}{' '}
                            <span className="text-sm text-slate-600">
                              (latest check-in{' '}
                              {provisionalSummary.leaderLatestDates[index]})
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-slate-600">
                        {provisionalSummary.eligibleParticipantCount} of{' '}
                        {provisionalSummary.activeParticipantCount} active
                        participants have both comparison check-ins. Ties are
                        shared.
                      </p>
                    </>
                  ) : provisionalSummary?.state === 'no-eligible-candidates' ? (
                    <p className="mt-3 text-sm text-slate-700">
                      No one has both a saved check-in on{' '}
                      {provisionalSummary.previousSunday} and one during this
                      week yet. The provisional leader updates as entries are
                      saved.
                    </p>
                  ) : provisionalMessage ? (
                    <p className="mt-3 text-sm text-slate-600" role="status">
                      {provisionalMessage}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600" role="status">
                      Loading this week’s group update…
                    </p>
                  )}
                </section>
              ) : null}
              <ProgressBar
                label="Progress toward target"
                value={data.flow.dashboard.completionPercentage ?? 0}
              />
              <p className="text-sm leading-6 text-slate-600">
                {data.flow.progressSummary.message}
              </p>
              <h2 className="text-xl font-bold">Weight history</h2>
              {data.flow.historyTrend.history.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No weigh-ins saved yet.
                </p>
              ) : (
                <ul aria-label="Saved weight history" className="space-y-3">
                  {data.flow.historyTrend.history.map((weighIn) => (
                    <li
                      className="rounded-xl border border-stone-200 p-4"
                      key={`${weighIn.participantId}-${weighIn.date}`}
                    >
                      <span className="font-semibold">{weighIn.date}</span>:{' '}
                      {weighIn.weightKg} kg
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-slate-600">
                Trend:{' '}
                {data.flow.historyTrend.trendChangeKg === null
                  ? 'Not enough saved records yet.'
                  : `${data.flow.historyTrend.trendChangeKg} kg`}
              </p>
            </div>
          ) : null}
        </DashboardState>
      </Card>
    </section>
  )
}

export function GoalsPage() {
  const { data, isLoading, message, messageTone } = usePersonalDashboard()
  const [celebrationAnnouncement, setCelebrationAnnouncement] = useState('')

  useEffect(() => {
    if (!data) {
      setCelebrationAnnouncement('')
      return
    }

    setCelebrationAnnouncement(
      reconcileMilestoneCelebration(
        data.viewerId,
        createParticipantMilestones(data.flow.dashboard),
      ),
    )
  }, [data])

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="goals-title">
      <Card className="p-8 sm:p-12">
        <PageHeader
          description="Your saved challenge target and milestone progress."
          title="Goals"
          titleId="goals-title"
        >
          <StatusPill>
            {data?.challenge.name ?? 'Personal dashboard'}
          </StatusPill>
        </PageHeader>
        <DashboardState
          isLoading={isLoading}
          message={message}
          messageTone={messageTone}
        >
          {data ? (
            <MilestoneProgress
              celebrationAnnouncement={celebrationAnnouncement}
              direction={data.flow.dashboard.progressState.direction}
              milestones={createParticipantMilestones(data.flow.dashboard)}
            />
          ) : null}
        </DashboardState>
      </Card>
    </section>
  )
}

export function MilestonePreviewPage() {
  return (
    <section
      className="mx-auto w-full max-w-3xl"
      aria-labelledby="preview-title"
    >
      <Card className="p-6 sm:p-10">
        <PageHeader
          description="A local, reusable preview of the participant milestone component."
          title="Milestone progress preview"
          titleId="preview-title"
        >
          <MilestoneProgress milestones={milestonePreview} />
        </PageHeader>
      </Card>
    </section>
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

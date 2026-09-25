import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Card, PageHeader, ProgressBar, StatusPill } from '../components/ui'
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
        setIsLoading(false)
        return
      }
      if (persistence.mode === 'unavailable') {
        setData(null)
        setMessage(persistence.message)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const challenges =
        await persistence.repositories.challenges.listVisibleToUser(ownerId)
      if (!isCurrent) return
      if (challenges.state === 'error') {
        setData(null)
        setMessage(challenges.error.message)
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
        setIsLoading(false)
        return
      }

      const participants =
        await persistence.repositories.participants.listForUser(ownerId)
      if (!isCurrent) return
      if (participants.state === 'error') {
        setData(null)
        setMessage(participants.error.message)
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
  }
}

function DashboardState({
  children,
  isLoading,
  message,
  messageContent,
}: {
  children: ReactNode
  isLoading: boolean
  message: string
  messageContent?: ReactNode
}) {
  if (isLoading) {
    return (
      <p aria-live="polite" className="text-sm text-slate-600" role="status">
        Loading your saved dashboard…
      </p>
    )
  }
  if (message) {
    if (messageContent) return <>{messageContent}</>
    return (
      <p aria-live="polite" className="text-sm text-slate-600" role="status">
        {message}
      </p>
    )
  }
  return <>{children}</>
}

export function HomePage() {
  const { state: authState } = useOptionalAuth()
  const ownerId = authState.user?.id
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState('')
  const [isLoading, setIsLoading] = useState(authState.status === 'signed-in')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadChallenges() {
      if (authState.status !== 'signed-in' || !ownerId) {
        setChallenges([])
        setSelectedChallengeId('')
        setIsLoading(false)
        setLoadError('')
        return
      }

      if (persistence.mode === 'unavailable') {
        setLoadError(persistence.message)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const result =
        await persistence.repositories.challenges.listVisibleToUser(ownerId)
      if (!isCurrent) return

      if (result.state === 'error') {
        setLoadError(result.error.message)
        setChallenges([])
      } else {
        const nextChallenges = result.state === 'success' ? result.data : []
        setChallenges(nextChallenges)
        setSelectedChallengeId((currentId) =>
          nextChallenges.some(({ id }) => id === currentId)
            ? currentId
            : (nextChallenges[0]?.id ?? ''),
        )
        setLoadError('')
      }
      setIsLoading(false)
    }

    void loadChallenges()
    return () => {
      isCurrent = false
    }
  }, [authState.status, ownerId, persistence])

  if (authState.status === 'signed-in') {
    const selectedChallenge = challenges.find(
      ({ id }) => id === selectedChallengeId,
    )
    const challengeQuery = selectedChallenge
      ? `?challenge=${encodeURIComponent(selectedChallenge.id)}`
      : ''

    return (
      <section className="w-full" aria-labelledby="home-title">
        <Card className="mx-auto max-w-4xl p-8 sm:p-12">
          <PageHeader
            description={
              selectedChallenge
                ? 'Continue with the challenge selected for this account.'
                : 'Set up your first challenge to begin recording progress.'
            }
            title="Welcome back."
            titleId="home-title"
          >
            <StatusPill tone="success">Signed in</StatusPill>
          </PageHeader>

          <p className="mt-6 text-sm text-slate-600">
            Signed in as <strong>{authState.user.email}</strong>
          </p>

          {isLoading ? (
            <p
              aria-live="polite"
              className="mt-8 text-sm text-slate-600"
              role="status"
            >
              Loading your saved challenges…
            </p>
          ) : loadError ? (
            <p
              aria-live="polite"
              className="mt-8 text-sm text-red-700"
              role="alert"
            >
              {loadError}
            </p>
          ) : challenges.length === 0 ? (
            <div className="mt-8 space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                No saved challenge is available for this account yet.
              </p>
              <Link
                className="inline-block rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                to="/challenge/setup"
              >
                Set up a challenge
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div>
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="selected-challenge"
                >
                  Selected challenge
                </label>
                <select
                  className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  id="selected-challenge"
                  onChange={(event) =>
                    setSelectedChallengeId(event.target.value)
                  }
                  value={selectedChallengeId}
                >
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name}
                    </option>
                  ))}
                </select>
              </div>
              <nav aria-label="Selected challenge navigation">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Today', '/today'],
                    ['Progress', '/progress'],
                    ['Group', '/group'],
                    ['Goals', '/goals'],
                    ['Invite participants', '/challenge/invites'],
                  ].map(([label, path]) => (
                    <li key={path}>
                      <Link
                        className="inline-block w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-emerald-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                        to={`${path}${challengeQuery}`}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          )}
        </Card>
      </section>
    )
  }

  return (
    <section className="w-full" aria-labelledby="welcome-title">
      <Card className="mx-auto grid max-w-4xl overflow-hidden p-0 md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-8 sm:p-12">
          <PageHeader
            description="A calm, focused space for building sustainable progress together."
            title="Your challenge starts here."
            titleId="welcome-title"
          >
            <StatusPill tone="success">Public preview</StatusPill>
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
        setIsLoading(false)
        return
      }
      if (persistence.mode === 'unavailable') {
        setData(null)
        setChallenges([])
        setMessage('Shared group progress requires a signed-in server session.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessage('')
      const challengeResult =
        await persistence.repositories.challenges.listVisibleToUser(ownerId)
      if (!isCurrent) return
      if (challengeResult.state === 'error') {
        setData(null)
        setChallenges([])
        setMessage('Unable to load the selected group challenge.')
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
      } else {
        const weeklyCelebration = createSavedWeeklyWinCelebration(result.data)
        setData({ challenge, summary: result.data })
        setWeeklyAnnouncement(
          reconcileWeeklyWinCelebration(ownerId, weeklyCelebration),
        )
        setMessage('')
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
        <DashboardState isLoading={isLoading} message={message}>
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
  const { data, isLoading, message } = usePersonalDashboard()
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
        <DashboardState isLoading={isLoading} message={message}>
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
  const { data, isLoading, message } = usePersonalDashboard()
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
        <DashboardState isLoading={isLoading} message={message}>
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

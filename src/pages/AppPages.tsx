import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
  type FeedbackTone,
} from '../components/ui'
import { MilestoneProgress } from '../components/MilestoneProgress'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import { ChallengeTabs } from '../components/ChallengeContextTabs'
import { WeightPageHeader } from '../components/WeightPageHeader'
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
import type { PersonalWeighIn } from '../models/personalWeighIn'
import {
  mostRecentSunday,
  type GroupProgressSummary,
  type GroupWeighInHistoryEntry,
} from '../models/groupProgress'
import {
  localDateOnly,
  type ProvisionalGroupLeaderSummary,
} from '../models/provisionalGroupLeader'
import { createSavedWeeklyWinCelebration } from '../models/weeklyCelebrations'
import { calculateDailyWeightChange } from '../models/weightChange'
import { calculatePersonalWeeklyChange } from '../models/personalWeeklyChange'

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
  provisionalLeader: ProvisionalGroupLeaderSummary | null
  provisionalLeaderState: 'error' | 'loading' | 'ready'
  summary: GroupProgressSummary
}

type PersonalDashboardSnapshot = {
  data: PersonalDashboardData | null
  enrollmentChallengeId: string
  isLoading: boolean
  isMissingChallenge: boolean
  isMissingMembership: boolean
  message: string
  messageTone: FeedbackTone
  requestKey: string
}

function challengeContextName(challenge?: Challenge) {
  if (!challenge) return 'Selected challenge'
  return `${challenge.kind === 'personal' ? 'Personal' : 'Group'} · ${challenge.name}`
}

function forParticipant(
  entries: PersonalWeighIn[],
  participantId: string,
): WeighIn[] {
  return entries
    .filter((entry) => entry.date <= localDateOnly())
    .map((entry) => ({
      date: entry.date,
      ...(entry.note ? { note: entry.note } : {}),
      participantId,
      weightKg: entry.weightKg,
    }))
}

function usePersonalDashboard({ preferJoinedChallenge = false } = {}) {
  const { state: authState } = useOptionalAuth()
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const ownerId = authState.user?.id
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const requestKey = JSON.stringify([
    authState.status,
    ownerId ?? null,
    challengeParam,
    persistence.mode,
    preferJoinedChallenge,
  ])
  const [snapshot, setSnapshot] = useState<PersonalDashboardSnapshot>({
    data: null,
    enrollmentChallengeId: '',
    isLoading: true,
    isMissingChallenge: false,
    isMissingMembership: false,
    message: '',
    messageTone: 'info',
    requestKey: '',
  })

  useEffect(() => {
    let isCurrent = true
    const baseSnapshot: PersonalDashboardSnapshot = {
      data: null,
      enrollmentChallengeId: '',
      isLoading: false,
      isMissingChallenge: false,
      isMissingMembership: false,
      message: '',
      messageTone: 'info',
      requestKey,
    }

    async function loadDashboard() {
      setSnapshot({ ...baseSnapshot, isLoading: true })
      if (authState.status !== 'signed-in' || !ownerId) {
        setSnapshot({
          ...baseSnapshot,
          message: 'Sign in to view your saved dashboard.',
        })
        return
      }
      if (persistence.mode === 'unavailable') {
        setSnapshot({ ...baseSnapshot, message: persistence.message })
        return
      }

      try {
        const [challengeResult, participantResult] = await Promise.all([
          persistence.repositories.challenges.listVisibleToUser(ownerId),
          persistence.repositories.participants.listForUser(ownerId),
        ])
        if (!isCurrent) return
        if (challengeResult.state === 'error') {
          setSnapshot({
            ...baseSnapshot,
            message: 'Your challenges could not be loaded. Try refreshing.',
            messageTone: 'error',
          })
          return
        }
        if (participantResult.state === 'error') {
          setSnapshot({
            ...baseSnapshot,
            message:
              'Your challenge memberships could not be loaded. Try refreshing.',
            messageTone: 'error',
          })
          return
        }

        const savedChallenges =
          challengeResult.state === 'success' ? challengeResult.data : []
        const participantRows =
          participantResult.state === 'success' ? participantResult.data : []
        const activeParticipants = participantRows.filter(
          (participant) => participant.status === 'active',
        )
        const challenge = challengeParam
          ? savedChallenges.find(({ id }) => id === challengeParam)
          : preferJoinedChallenge
            ? (savedChallenges.find((savedChallenge) =>
                activeParticipants.some(
                  ({ challengeId }) => challengeId === savedChallenge.id,
                ),
              ) ??
              savedChallenges.find(
                ({ ownerId: challengeOwnerId }) => challengeOwnerId === ownerId,
              ) ??
              savedChallenges[0])
            : savedChallenges[0]

        if (!challenge) {
          setSnapshot({
            ...baseSnapshot,
            isMissingChallenge: savedChallenges.length === 0,
            message:
              savedChallenges.length === 0
                ? 'Set up a challenge before viewing your dashboard.'
                : 'The selected challenge is unavailable for this account.',
            messageTone: 'empty',
          })
          return
        }

        const participant = activeParticipants.find(
          (candidate) => candidate.challengeId === challenge.id,
        )
        if (!participant) {
          const isOwner = challenge.ownerId === ownerId
          setSnapshot({
            ...baseSnapshot,
            enrollmentChallengeId: isOwner ? challenge.id : '',
            isMissingMembership: true,
            message: isOwner
              ? 'You have not enrolled in this challenge yet.'
              : 'You are not an active member of this challenge. Ask its owner for an invitation, or choose a challenge you have joined.',
            messageTone: 'info',
          })
          return
        }

        const weighIns =
          await persistence.repositories.personalWeighIns.listForUser(ownerId)
        if (!isCurrent) return
        if (weighIns.state === 'error') {
          setSnapshot({
            ...baseSnapshot,
            message:
              'Your saved weigh-ins could not be loaded. Try refreshing.',
            messageTone: 'error',
          })
          return
        }
        const records =
          weighIns.state === 'success'
            ? forParticipant(weighIns.data, participant.id)
            : []
        setSnapshot({
          ...baseSnapshot,
          data: {
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
          },
        })
      } catch {
        if (!isCurrent) return
        setSnapshot({
          ...baseSnapshot,
          message: 'Your saved dashboard could not be loaded. Try refreshing.',
          messageTone: 'error',
        })
      }
    }

    void loadDashboard()
    return () => {
      isCurrent = false
    }
  }, [
    authState.status,
    challengeParam,
    ownerId,
    persistence,
    preferJoinedChallenge,
    requestKey,
  ])

  const isCurrentSnapshot = snapshot.requestKey === requestKey
  return {
    data: isCurrentSnapshot ? snapshot.data : null,
    enrollmentChallengeId: isCurrentSnapshot
      ? snapshot.enrollmentChallengeId
      : '',
    isLoading: !isCurrentSnapshot || snapshot.isLoading,
    isMissingChallenge: isCurrentSnapshot && snapshot.isMissingChallenge,
    isMissingMembership: isCurrentSnapshot && snapshot.isMissingMembership,
    message: isCurrentSnapshot ? snapshot.message : '',
    messageTone: isCurrentSnapshot ? snapshot.messageTone : 'info',
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
  const [loadedOwnerId, setLoadedOwnerId] = useState('')
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
        setLoadedOwnerId('')
        setOverview(null)
        setIsLoading(false)
        setLoadError('')
        return
      }

      if (persistence.mode === 'unavailable') {
        setChallenges([])
        setParticipants([])
        setLoadedOwnerId(ownerId)
        setOverview(null)
        setLoadError(persistence.message)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError('')
      setLoadedOwnerId('')
      setChallenges([])
      setParticipants([])
      setOverview(null)
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
      setLoadedOwnerId(ownerId)
      setIsLoading(false)
    }

    void loadChallenges()
    return () => {
      isCurrent = false
    }
  }, [authState.status, ownerId, persistence])

  const selectedChallenge =
    loadedOwnerId === ownerId
      ? (challenges.find(({ id }) => id === challengeParam) ??
        challenges[0] ??
        null)
      : null
  const activeParticipant = selectedChallenge
    ? (participants.find(
        (participant) =>
          participant.challengeId === selectedChallenge.id &&
          participant.status === 'active',
      ) ?? null)
    : null

  useEffect(() => {
    if (
      isLoading ||
      loadedOwnerId !== ownerId ||
      loadError ||
      authState.status !== 'signed-in'
    )
      return
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
    loadedOwnerId,
    ownerId,
    loadError,
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
        !ownerId ||
        !selectedChallenge ||
        !activeParticipant ||
        persistence.mode === 'unavailable'
      ) {
        return
      }

      setIsOverviewLoading(true)
      try {
        const [weighIns, groupResult] = await Promise.all([
          persistence.repositories.personalWeighIns.listForUser(ownerId),
          selectedChallenge.kind === 'group'
            ? persistence.repositories.groupProgress.getForChallenge(
                selectedChallenge.id,
                mostRecentSunday(),
              )
            : Promise.resolve({ state: 'empty' as const }),
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
                  weighIns:
                    weighIns.state === 'success'
                      ? forParticipant(weighIns.data, activeParticipant.id)
                      : [],
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
  }, [activeParticipant, isLoading, ownerId, persistence, selectedChallenge])

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
        <Card className="grid overflow-hidden border-forest-200 p-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-forest-50 via-panel to-forest-100 p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
              A steadier way forward
            </p>
            <h1
              className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl"
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
          <div className="flex min-h-52 items-center border-t border-line bg-panel p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <p className="max-w-sm text-lg leading-7 text-ink-muted">
              Personal weigh-ins stay in your view. Only authorized, shared
              summaries appear with a group.
            </p>
          </div>
        </Card>
      </section>
    )
  }

  if (isLoading || loadedOwnerId !== ownerId) {
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
  const isGroup = selectedChallenge?.kind === 'group'
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
        ...(isGroup
          ? [['Group progress', `/group${challengeQuery}`] as [string, string]]
          : []),
        ['Goals', `/goals${challengeQuery}`],
        ...(isOwner && isGroup
          ? ([
              ['Invite participants', `/challenge/invites${challengeQuery}`],
            ] as [string, string][])
          : []),
      ]
    : isOwner && selectedChallenge
      ? [
          [
            'Enroll yourself',
            `/challenge/participants/enroll?challenge=${encodeURIComponent(selectedChallenge.id)}&self=owner`,
          ],
          ...(isGroup
            ? [
                [
                  'Invite participants',
                  `/challenge/invites${challengeQuery}`,
                ] as [string, string],
              ]
            : []),
        ]
      : []
  const heroActions: [string, string][] = isActiveMember
    ? [['View my progress', `/progress${challengeQuery}`]]
    : isOwner && selectedChallenge
      ? [
          [
            'Enroll yourself',
            `/challenge/participants/enroll?challenge=${encodeURIComponent(selectedChallenge.id)}&self=owner`,
          ],
          ...(isGroup
            ? [
                [
                  'Invite participants',
                  `/challenge/invites${challengeQuery}`,
                ] as [string, string],
              ]
            : []),
        ]
      : selectedChallenge
        ? []
        : [['Set up a challenge', '/challenge/setup']]

  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-8"
      aria-labelledby="challenges-title"
    >
      <WeightPageHeader>
        <PageHeader
          title="Challenges"
          titleId="challenges-title"
          description="Your challenges and shared progress."
        />
      </WeightPageHeader>
      <div className="order-1 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex min-h-[240px] flex-col justify-between gap-8 overflow-hidden border-forest-200 bg-gradient-to-br from-forest-50 via-panel to-forest-100 p-7 sm:p-10 lg:p-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
              {selectedChallenge ? 'Your challenge' : 'Your overview'}
            </p>
            <h2
              className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl"
              id="home-title"
            >
              Keep showing up.
              <span className="block text-forest-700">It adds up.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">
              {selectedChallenge
                ? 'Your personal progress stays yours. Shared group information appears only when your membership allows it.'
                : 'Set up a challenge or join one with an invitation to see your saved progress here.'}
            </p>
          </div>
          {heroActions.length ? (
            <div className="flex flex-wrap gap-3">
              {heroActions.map(([label, href], index) => (
                <Link
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${index === 0 ? 'bg-forest-800 text-white hover:bg-forest-900' : 'border border-line bg-panel text-forest-800 hover:bg-forest-50'}`}
                  key={href}
                  to={href}
                >
                  {label}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : null}
        </Card>

        <article className={panelClass} aria-labelledby="latest-entry-title">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
            Your latest · private view
          </p>
          <h2
            className="mt-2 text-lg font-bold text-ink"
            id="latest-entry-title"
          >
            Your latest weigh-in
          </h2>
          {isOverviewLoading ? (
            <p className="mt-5 text-sm text-ink-muted" role="status">
              Loading your saved entry…
            </p>
          ) : latestWeighIn ? (
            <>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-ink">
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
        <section aria-labelledby="challenge-picker-title" className="order-3">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {(['personal', 'group'] as const).map((kind) => (
              <section
                className={panelClass}
                key={kind}
                aria-label={
                  kind === 'personal'
                    ? 'Personal challenge'
                    : 'Group challenges'
                }
              >
                <h2 className="font-bold">
                  {kind === 'personal'
                    ? 'Personal challenge'
                    : 'Group challenges'}
                </h2>
                <p className="mt-2 text-sm text-ink-muted">
                  {challenges.some((challenge) => challenge.kind === kind)
                    ? kind === 'personal'
                      ? 'Private to your account.'
                      : 'Owned and joined group contexts.'
                    : kind === 'personal'
                      ? 'No personal challenge yet.'
                      : 'No group challenge yet.'}
                </p>
                <Link
                  className="mt-3 inline-block text-sm font-bold text-forest-800 underline"
                  to={`/challenge/setup?kind=${kind}`}
                >
                  {kind === 'personal'
                    ? 'Create a personal challenge'
                    : 'Create a group challenge'}
                </Link>
              </section>
            ))}
          </div>
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
                  className={`flex min-h-36 w-full flex-col items-start justify-between gap-4 rounded-panel border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${isSelected ? 'border-forest-700 bg-forest-50 shadow-panel' : 'border-line bg-panel hover:border-forest-200 hover:bg-panel'}`}
                  key={challenge.id}
                  onClick={() => selectChallenge(challenge.id)}
                  type="button"
                >
                  <span className="rounded-full bg-panel px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-800">
                    {challenge.ownerId === ownerId
                      ? 'Challenge owner'
                      : 'Joined challenge'}
                  </span>
                  <span className="block text-lg font-bold text-ink">
                    {challenge.name}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {challenge.kind === 'personal'
                      ? 'Personal · private'
                      : 'Group'}{' '}
                    ·{' '}
                    {challenge.ownerId === ownerId
                      ? participants.some(
                          (participant) =>
                            participant.challengeId === challenge.id &&
                            participant.status === 'active',
                        )
                        ? 'Organizer and participant'
                        : 'Organizer only'
                      : 'Participant'}
                  </span>
                  <span className="flex w-full items-center justify-between border-t border-line pt-3 text-sm font-semibold text-forest-800">
                    {isSelected ? 'Currently selected' : 'Select to view'}
                    <span aria-hidden="true">→</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <FeedbackPanel className="order-3 w-full" tone="empty">
          No saved challenge is available for this account yet. Set up a
          challenge or join one with an invitation.
        </FeedbackPanel>
      )}

      {selectedChallenge ? (
        <>
          {isActiveMember ? (
            <section aria-labelledby="snapshot-title" className="order-2">
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
                  {isGroup ? (
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
                  ) : null}
                </div>
              )}
            </section>
          ) : (
            <FeedbackPanel className="order-4 w-full" tone="info">
              {isOwner
                ? 'Enroll yourself to view personal and member summaries. You can still invite participants as the owner.'
                : 'Personal and group summaries are available after you join this challenge.'}
            </FeedbackPanel>
          )}

          {availableActions.length ? (
            <section aria-labelledby="actions-title" className="order-5">
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
  const { state: authState } = useOptionalAuth()
  const {
    data,
    enrollmentChallengeId,
    isLoading,
    isMissingChallenge,
    isMissingMembership,
    message,
    messageTone,
  } = usePersonalDashboard({ preferJoinedChallenge: true })
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [groupSnapshot, setGroupSnapshot] = useState<
    | { key: string; state: 'loading' | 'unavailable' | 'error' }
    | { key: string; state: 'success'; summary: GroupProgressSummary }
  >({ key: '', state: 'loading' })
  const dashboardChallengeId = data?.challenge.id ?? null
  const dashboardViewerId = data?.viewerId ?? null
  const dashboardChallengeKind = data?.challenge.kind
  const groupSnapshotKey = data
    ? JSON.stringify([data.viewerId, data.challenge.id])
    : ''

  useEffect(() => {
    let isCurrent = true
    if (
      !dashboardChallengeId ||
      !dashboardViewerId ||
      dashboardChallengeKind !== 'group'
    )
      return

    const key = JSON.stringify([dashboardViewerId, dashboardChallengeId])
    if (persistence.mode !== 'remote') {
      setGroupSnapshot({ key, state: 'unavailable' })
      return
    }

    setGroupSnapshot({ key, state: 'loading' })
    persistence.repositories.groupProgress
      .getForChallenge(dashboardChallengeId, mostRecentSunday())
      .then((result) => {
        if (!isCurrent) return
        setGroupSnapshot(
          result.state === 'success'
            ? { key, state: 'success', summary: result.data }
            : { key, state: 'error' },
        )
      })
      .catch(() => {
        if (isCurrent) setGroupSnapshot({ key, state: 'error' })
      })

    return () => {
      isCurrent = false
    }
  }, [
    dashboardChallengeId,
    dashboardViewerId,
    dashboardChallengeKind,
    persistence,
  ])

  const challengeQuery = data
    ? `?challenge=${encodeURIComponent(data.challenge.id)}`
    : ''
  const currentGroupSnapshot =
    groupSnapshot.key === groupSnapshotKey ? groupSnapshot : null
  const latestWeighIn = data?.flow.dashboard.latestWeighIn ?? null
  const challengeStatus = data?.challenge.status
  const challengeStatusLabel =
    challengeStatus === 'active'
      ? 'Active'
      : challengeStatus === 'completed'
        ? 'Completed'
        : challengeStatus === 'archived'
          ? 'Archived'
          : 'Draft'

  function formatWeight(weightKg: number) {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(weightKg)} kg`
  }

  function formatDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsedDate.getTime())
      ? date
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
          parsedDate,
        )
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6"
      aria-labelledby="today-title"
    >
      <WeightPageHeader>
        <PageHeader
          description="Your personal check-in for the selected challenge, with group summaries only in group contexts."
          title="Today"
          titleId="today-title"
        >
          <StatusPill className="max-w-full whitespace-normal break-words">
            {data
              ? `${challengeContextName(data.challenge)} · ${challengeStatusLabel}`
              : 'Daily check-in'}
          </StatusPill>
        </PageHeader>
      </WeightPageHeader>

      <DashboardState
        isLoading={isLoading}
        message={message}
        messageTone={messageTone}
        messageContent={
          isMissingChallenge ? (
            <Card className="space-y-4 p-6 sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Your daily check-in
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-ink">
                  No challenge yet
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                  There is no saved challenge for this account yet. Set one up
                  to start tracking your progress.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800"
                to="/challenge/setup"
              >
                Set up a challenge
              </Link>
            </Card>
          ) : isMissingMembership ? (
            <Card className="space-y-4 p-6 sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Challenge enrollment
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-ink">
                  You are not enrolled yet
                </h2>
                <p
                  aria-live="polite"
                  className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted"
                  role="status"
                >
                  {message}
                </p>
              </div>
              {enrollmentChallengeId ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl bg-forest-800 px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800"
                  to={`/challenge/participants/enroll?challenge=${encodeURIComponent(enrollmentChallengeId)}&self=owner`}
                >
                  Enroll yourself
                </Link>
              ) : (
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 py-3 text-sm font-bold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800"
                  to="/"
                >
                  Choose a joined challenge
                </Link>
              )}
            </Card>
          ) : messageTone === 'error' ? (
            <FeedbackPanel className="w-full" tone="error">
              {message}
            </FeedbackPanel>
          ) : undefined
        }
      >
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <article
                aria-labelledby="today-latest-entry-title"
                className="rounded-panel border border-line/80 bg-panel p-5 shadow-panel sm:p-7"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Latest personal entry
                </p>
                <h2
                  className="mt-3 text-xl font-extrabold text-ink"
                  id="today-latest-entry-title"
                >
                  {latestWeighIn ? 'Your latest weigh-in' : 'No weigh-ins yet'}
                </h2>
                {latestWeighIn ? (
                  <>
                    <p className="mt-4 text-4xl font-extrabold tracking-tight text-ink">
                      {formatWeight(latestWeighIn.weightKg)}
                    </p>
                    <time
                      className="mt-2 block text-sm text-ink-muted"
                      dateTime={latestWeighIn.date}
                    >
                      {formatDate(latestWeighIn.date)}
                    </time>
                    {latestWeighIn.note ? (
                      <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-forest-700">
                          Private note · only you can see this
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                          {latestWeighIn.note}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-5 text-sm text-ink-muted">
                        No private note was saved with this entry.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-ink-muted">
                    Record your first weigh-in to start your personal check-in.
                  </p>
                )}
                <Link
                  className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-forest-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800"
                  to={`/progress${challengeQuery}`}
                >
                  See your personal progress
                </Link>
              </article>

              {data.challenge.kind === 'group' ? (
                <article
                  aria-labelledby="today-group-summary-title"
                  className="rounded-panel border border-line/80 bg-forest-800 p-5 text-white shadow-panel sm:p-7"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-100">
                    Selected challenge · shared summary
                  </p>
                  <h2
                    className="mt-3 text-xl font-extrabold"
                    id="today-group-summary-title"
                  >
                    This week’s check-ins
                  </h2>
                  {currentGroupSnapshot?.state === 'success' ? (
                    <>
                      <p className="mt-4 text-4xl font-extrabold tracking-tight">
                        {currentGroupSnapshot.summary.eligibleParticipantCount}{' '}
                        / {currentGroupSnapshot.summary.activeParticipantCount}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-forest-50">
                        Members with a qualifying comparison ·{' '}
                        {formatDate(
                          currentGroupSnapshot.summary.previousSunday,
                        )}
                        {' – '}
                        {formatDate(currentGroupSnapshot.summary.currentSunday)}
                      </p>
                    </>
                  ) : !currentGroupSnapshot ||
                    currentGroupSnapshot.state === 'loading' ? (
                    <p className="mt-4 text-sm text-forest-50" role="status">
                      Loading the permitted group summary…
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-forest-50">
                      {currentGroupSnapshot?.state === 'error'
                        ? 'The shared summary is unavailable right now. Try refreshing.'
                        : 'A shared summary is not available in this data mode.'}
                    </p>
                  )}
                  <Link
                    className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    to={`/group${challengeQuery}`}
                  >
                    See group progress
                  </Link>
                </article>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-panel border border-line/80 bg-panel p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-700">
                  Current status
                </p>
                <h2 className="mt-2 text-lg font-extrabold text-ink">
                  {challengeStatusLabel} ·{' '}
                  {data.challenge.ownerId === data.viewerId
                    ? 'owner and active participant'
                    : 'joined member'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  {data.flow.progressSummary.message}
                </p>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-forest-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800"
                  to={`/goals${challengeQuery}`}
                >
                  View your challenge goal
                </Link>
              </article>

              <div
                aria-label="Personal weigh-in sharing"
                className="flex flex-col justify-center rounded-panel border border-dashed border-line bg-canvas p-5 sm:p-6"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
                  Personal history
                </p>
                <h2 className="mt-2 text-lg font-extrabold text-ink">
                  One entry, optional group sharing
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  You can switch between joined challenges from Overview. Each
                  weigh-in stays in your personal history; only explicitly
                  selected groups receive its date and weight, never your note.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardState>
    </section>
  )
}

export function GroupDashboardPage() {
  const { state: authState } = useOptionalAuth()
  const ownerId = authState.user?.id
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [savedData, setData] = useState<GroupDashboardData | null>(null)
  const [savedChallenges, setChallenges] = useState<Challenge[]>([])
  const requestKey = `${authState.status}:${ownerId ?? ''}:${challengeParam ?? ''}:${persistence.mode}`
  const [loadedKey, setLoadedKey] = useState('')
  const data = loadedKey === requestKey ? savedData : null
  const challenges = loadedKey === requestKey ? savedChallenges : []
  const [isLoading, setIsLoading] = useState(authState.status === 'signed-in')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<FeedbackTone>('info')
  const [reloadKey, setReloadKey] = useState(0)
  const [weeklyAnnouncement, setWeeklyAnnouncement] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadGroupDashboard() {
      setLoadedKey(requestKey)
      setChallenges([])
      setData(null)
      setWeeklyAnnouncement('')
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

      const allVisibleChallenges =
        challengeResult.state === 'success' ? challengeResult.data : []
      const visibleChallenges = allVisibleChallenges.filter(
        ({ kind }) => kind === 'group',
      )
      setChallenges(allVisibleChallenges)
      const challenge = challengeParam
        ? visibleChallenges.find(({ id }) => id === challengeParam)
        : visibleChallenges[0]
      if (!challenge) {
        setData(null)
        setMessage(
          challengeParam &&
            allVisibleChallenges.some(
              ({ id, kind }) => id === challengeParam && kind === 'personal',
            )
            ? 'Personal challenges are private and do not have a group dashboard.'
            : visibleChallenges.length === 0
              ? 'No group challenge is available for this account.'
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
        setData({
          challenge,
          provisionalLeader: null,
          provisionalLeaderState: 'loading',
          summary: result.data,
        })
        setWeeklyAnnouncement(
          reconcileWeeklyWinCelebration(ownerId, weeklyCelebration),
        )
        setMessage('')
        setMessageTone('info')
        setIsLoading(false)

        try {
          const provisionalResult =
            await persistence.repositories.groupProgress.getProvisionalLeader(
              challenge.id,
              localDateOnly(),
            )
          if (!isCurrent) return

          if (
            provisionalResult.state === 'success' &&
            provisionalResult.data.challengeId === challenge.id
          ) {
            setData((currentData) =>
              currentData?.challenge.id === challenge.id
                ? {
                    ...currentData,
                    provisionalLeader: provisionalResult.data,
                    provisionalLeaderState: 'ready',
                  }
                : currentData,
            )
          } else {
            setData((currentData) =>
              currentData?.challenge.id === challenge.id
                ? { ...currentData, provisionalLeaderState: 'error' }
                : currentData,
            )
          }
        } catch {
          if (!isCurrent) return
          setData((currentData) =>
            currentData?.challenge.id === challenge.id
              ? { ...currentData, provisionalLeaderState: 'error' }
              : currentData,
          )
        }
      }
      setIsLoading(false)
    }

    void loadGroupDashboard()
    return () => {
      isCurrent = false
    }
  }, [
    authState.status,
    challengeParam,
    ownerId,
    persistence,
    reloadKey,
    requestKey,
  ])

  const summary = data?.summary
  const provisionalLeader = data?.provisionalLeader
  const weeklyCelebration = summary
    ? createSavedWeeklyWinCelebration(summary)
    : null
  const challengeQuery = data
    ? `?challenge=${encodeURIComponent(data.challenge.id)}`
    : ''
  const selectedChallengeId =
    challengeParam ??
    data?.challenge.id ??
    challenges.find(({ kind }) => kind === 'group')?.id ??
    ''
  const selectedChallenge = challenges.find(
    ({ id }) => id === selectedChallengeId,
  )

  function formatDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsedDate.getTime())
      ? date
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
          parsedDate,
        )
  }

  return (
    <div className="w-full space-y-6">
      <ChallengeTabs
        challenges={challenges}
        selectedId={selectedChallengeId}
        loading={isLoading}
      />
      <section
        className="mx-auto w-full max-w-6xl space-y-6"
        aria-labelledby="group-title"
      >
        <WeightPageHeader>
          <PageHeader
            description="Shared summary, this week’s provisional leader, and Sunday-based results for the selected challenge. Individual histories and private notes stay private."
            title="Group dashboard"
            titleId="group-title"
          >
            <StatusPill>
              {selectedChallenge?.name ??
                data?.challenge.name ??
                'Shared progress'}
            </StatusPill>
          </PageHeader>
        </WeightPageHeader>
        <Card className="p-5 sm:p-8 lg:p-10">
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <button
              className="min-h-11 rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
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
              <div className="mt-8 space-y-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <section
                    aria-labelledby="provisional-leader-heading"
                    className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                      This week
                    </p>
                    <h2
                      className="mt-2 text-xl font-bold text-slate-950"
                      id="provisional-leader-heading"
                    >
                      Provisional leader
                    </h2>
                    {data.provisionalLeaderState === 'loading' ? (
                      <p className="mt-4 text-sm text-slate-700" role="status">
                        Loading this week’s group update…
                      </p>
                    ) : data.provisionalLeaderState === 'error' ? (
                      <p className="mt-4 text-sm text-slate-700" role="status">
                        Provisional group progress is unavailable right now.
                      </p>
                    ) : provisionalLeader?.state === 'leaders' ? (
                      <>
                        <p className="mt-3 text-sm text-slate-700">
                          Comparing check-ins since Sunday{' '}
                          <time dateTime={provisionalLeader.previousSunday}>
                            {formatDate(provisionalLeader.previousSunday)}
                          </time>
                          ; this week runs{' '}
                          <time dateTime={provisionalLeader.currentWeekStart}>
                            {formatDate(provisionalLeader.currentWeekStart)}
                          </time>{' '}
                          to{' '}
                          <time dateTime={provisionalLeader.currentWeekEnd}>
                            {formatDate(provisionalLeader.currentWeekEnd)}
                          </time>
                          .
                        </p>
                        <p className="mt-4 text-lg font-bold text-slate-950">
                          {provisionalLeader.leaderCount > 1
                            ? 'Shared provisional leaders'
                            : 'Current provisional leader'}
                        </p>
                        <ul
                          aria-label="Provisional leaders"
                          className="mt-2 space-y-2"
                        >
                          {provisionalLeader.leaderNames.map((name, index) => (
                            <li
                              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white/80 px-4 py-3"
                              key={`${name}-${index}`}
                            >
                              <span className="font-semibold text-slate-950">
                                {name}
                              </span>
                              <span className="text-sm text-slate-600">
                                Latest check-in{' '}
                                <time
                                  dateTime={
                                    provisionalLeader.leaderLatestDates[index]
                                  }
                                >
                                  {formatDate(
                                    provisionalLeader.leaderLatestDates[index],
                                  )}
                                </time>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {provisionalLeader.eligibleParticipantCount} of{' '}
                          {provisionalLeader.activeParticipantCount} active
                          members have both comparison check-ins. Ties are
                          shared; this result is provisional until Sunday.
                        </p>
                      </>
                    ) : provisionalLeader?.state ===
                      'no-eligible-candidates' ? (
                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        No provisional leader is available yet. A member needs a
                        saved check-in on Sunday{' '}
                        <time dateTime={provisionalLeader.previousSunday}>
                          {formatDate(provisionalLeader.previousSunday)}
                        </time>{' '}
                        and one during this week. The result updates as saved
                        check-ins change.
                      </p>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        {provisionalLeader?.activeParticipantCount === 0
                          ? 'No active members are available for a provisional result.'
                          : 'At least two active members are needed for a provisional group result.'}
                      </p>
                    )}
                  </section>

                  <section
                    aria-labelledby="weekly-winners-heading"
                    className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                      Weekly highlights
                    </p>
                    <h2
                      className="mt-2 text-xl font-bold text-slate-950"
                      id="weekly-winners-heading"
                    >
                      Weekly result
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Based on consecutive Sunday check-ins:{' '}
                      <time dateTime={summary.previousSunday}>
                        {formatDate(summary.previousSunday)}
                      </time>{' '}
                      to{' '}
                      <time dateTime={summary.currentSunday}>
                        {formatDate(summary.currentSunday)}
                      </time>
                      .
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
                          : 'No weekly winner yet'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {weeklyCelebration?.message}
                    </p>
                    {weeklyCelebration &&
                    weeklyCelebration.state !== 'no-eligible-candidates' ? (
                      <ul
                        aria-label="Weekly winners"
                        className="mt-3 space-y-2"
                      >
                        {weeklyCelebration.winnerNames.map((name, index) => (
                          <li
                            className="rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-slate-900"
                            key={`${name}-${index}`}
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                </div>

                <section aria-labelledby="group-progress-heading">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
                    Selected challenge
                  </p>
                  <h2
                    className="mt-2 text-xl font-bold text-slate-950"
                    id="group-progress-heading"
                  >
                    Group progress
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {summary.participantsWithRecordedWeightCount} of{' '}
                    {summary.activeParticipantCount} active members have a saved
                    weigh-in. Only permitted group totals are shown here.
                  </p>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                      <dt className="text-sm font-semibold text-slate-600">
                        Active members
                      </dt>
                      <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {summary.activeParticipantCount}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                      <dt className="text-sm font-semibold text-slate-600">
                        Average goal progress
                      </dt>
                      <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {summary.averageCompletionPercentage === null
                          ? '—'
                          : `${summary.averageCompletionPercentage}%`}
                      </dd>
                      <dd className="mt-1 text-sm text-slate-600">
                        {summary.averageCompletionPercentage === null
                          ? 'Available after goal progress is recorded'
                          : `Across ${summary.participantsWithProgressCount} members`}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                      <dt className="text-sm font-semibold text-slate-600">
                        Members with a saved weigh-in
                      </dt>
                      <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {summary.participantsWithRecordedWeightCount}
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                      <dt className="text-sm font-semibold text-slate-600">
                        Goals reached
                      </dt>
                      <dd className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {summary.reachedTargetCount}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  aria-describedby="group-history-unavailable-copy"
                  aria-disabled="true"
                  aria-labelledby="group-history-heading"
                  className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 sm:p-7"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                    Not available yet · Chapter 16
                  </p>
                  <h2
                    className="mt-2 text-xl font-bold text-slate-800"
                    id="group-history-heading"
                  >
                    Group chart and weigh-in history
                  </h2>
                  <p
                    className="mt-2 max-w-3xl text-sm leading-6 text-slate-700"
                    id="group-history-unavailable-copy"
                  >
                    Individual weigh-in histories and chart lines are not shown.
                    This panel stays unavailable until Chapter 16 defines the
                    authorized group-history feature.
                  </p>
                </section>

                <Link
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  to={`/challenge/invites${challengeQuery}`}
                >
                  Invite participants
                </Link>
              </div>
            ) : null}
          </DashboardState>
        </Card>
      </section>
    </div>
  )
}

export function ProgressPage({
  personalHeader = false,
}: { personalHeader?: boolean } = {}) {
  const { data, isLoading, message, messageTone } = usePersonalDashboard()
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [provisionalSummary, setProvisionalSummary] =
    useState<ProvisionalGroupLeaderSummary | null>(null)
  const [provisionalMessage, setProvisionalMessage] = useState('')
  const [groupHistory, setGroupHistory] = useState<{
    challengeId: string
    entries: GroupWeighInHistoryEntry[]
    state: 'error' | 'loading' | 'success'
  } | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setProvisionalSummary(null)
    setProvisionalMessage('')
    if (
      !data ||
      data.challenge.kind !== 'group' ||
      persistence.mode !== 'remote'
    )
      return

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

  useEffect(() => {
    let isCurrent = true
    if (!data || data.challenge.kind !== 'group') {
      setGroupHistory(null)
      return
    }
    const challengeId = data.challenge.id
    setGroupHistory({ challengeId, entries: [], state: 'loading' })
    if (persistence.mode !== 'remote') {
      setGroupHistory({ challengeId, entries: [], state: 'error' })
      return
    }
    persistence.repositories.groupProgress
      .getWeighInHistory(challengeId)
      .then((result) => {
        if (!isCurrent) return
        setGroupHistory({
          challengeId,
          entries: result.state === 'success' ? result.data : [],
          state: result.state === 'error' ? 'error' : 'success',
        })
      })
      .catch(() => {
        if (isCurrent)
          setGroupHistory({ challengeId, entries: [], state: 'error' })
      })
    return () => {
      isCurrent = false
    }
  }, [data, persistence, refreshVersion])

  function formatWeight(weightKg: number) {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(weightKg)} kg`
  }

  function formatChange(changeKg: number) {
    const sign = changeKg > 0 ? '+' : changeKg < 0 ? '−' : ''
    return `${sign}${formatWeight(Math.abs(changeKg))}`
  }

  function formatDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsedDate.getTime())
      ? date
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
          parsedDate,
        )
  }

  const weeklyChange = data
    ? calculatePersonalWeeklyChange(
        data.weighIns,
        data.participant.id,
        localDateOnly(),
      )
    : null

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6"
      aria-labelledby="progress-title"
    >
      <WeightPageHeader>
        <PageHeader
          description="Your saved weigh-ins, personal trend, and goal progress for the selected challenge."
          title={personalHeader ? 'Challenge progress' : 'Progress'}
          titleId="progress-title"
        >
          <StatusPill>{challengeContextName(data?.challenge)}</StatusPill>
          {personalHeader ? (
            <Link
              className="ml-3 inline-flex min-h-11 items-center font-semibold text-forest-800 underline"
              to="/progress"
            >
              Back to My Progress
            </Link>
          ) : null}
        </PageHeader>
      </WeightPageHeader>
      <Card className="p-5 sm:p-8 lg:p-10">
        <DashboardState
          isLoading={isLoading}
          message={message}
          messageTone={messageTone}
        >
          {data ? (
            <div className="mt-8 space-y-6">
              {data.challenge.kind === 'group' &&
              persistence.mode === 'remote' &&
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
                        shared. This result is provisional until the week ends.
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

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-600">
                    Latest weight
                  </h2>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {data.flow.dashboard.currentWeightKg === null
                      ? 'No record yet'
                      : formatWeight(data.flow.dashboard.currentWeightKg)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.flow.dashboard.latestWeighIn
                      ? formatDate(data.flow.dashboard.latestWeighIn.date)
                      : 'Your first saved check-in will appear here.'}
                  </p>
                </article>

                <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-600">
                    Change this week
                  </h2>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {weeklyChange?.state === 'ready'
                      ? formatChange(weeklyChange.changeKg!)
                      : '—'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {weeklyChange?.state === 'ready'
                      ? `Saved check-ins: ${formatDate(weeklyChange.previousWeighIn!.date)} and ${formatDate(weeklyChange.currentWeighIn!.date)}.`
                      : weeklyChange?.state === 'no-current-week-record'
                        ? 'No saved check-in this week yet.'
                        : 'A saved check-in from last week is needed for comparison.'}
                  </p>
                </article>

                <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-600">
                    Since starting
                  </h2>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {data.flow.dashboard.totalChangeKg === null
                      ? '—'
                      : formatChange(data.flow.dashboard.totalChangeKg)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.flow.dashboard.startingWeightKg === null
                      ? 'Starting weight unavailable.'
                      : `From ${formatWeight(data.flow.dashboard.startingWeightKg)}.`}
                  </p>
                </article>

                <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-600">
                    Personal goal
                  </h2>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {data.flow.dashboard.targetWeightKg === null
                      ? 'No target set'
                      : formatWeight(data.flow.dashboard.targetWeightKg)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.flow.dashboard.remainingTargetWeightKg === null
                      ? data.flow.progressSummary.statusLabel
                      : `${formatWeight(data.flow.dashboard.remainingTargetWeightKg)} to goal.`}
                  </p>
                </article>
              </div>

              <MilestoneProgress
                direction={data.flow.dashboard.progressState.direction}
                milestones={createParticipantMilestones(data.flow.dashboard)}
                title="Your personal goal milestones"
              />

              <section
                aria-labelledby="personal-trend-title"
                className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Personal weight history
                </p>
                <h2
                  className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
                  id="personal-trend-title"
                >
                  Your saved trend
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Your personal history is independent of the selected
                  challenge. Missing dates have no estimated weights.
                </p>
                {data.flow.historyTrend.history.length === 0 ? (
                  <FeedbackPanel className="mt-5" tone="empty">
                    No weigh-ins saved yet. Your chart will appear after your
                    first check-in.
                  </FeedbackPanel>
                ) : (
                  <PersonalProgressChart
                    weighIns={data.flow.historyTrend.history}
                  />
                )}
                {data.flow.historyTrend.trendChangeKg !== null ? (
                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Change from first to latest saved check-in:{' '}
                    {formatChange(data.flow.historyTrend.trendChangeKg)}.
                  </p>
                ) : data.flow.historyTrend.state === 'insufficient-history' ? (
                  <p className="mt-4 text-sm text-slate-600">
                    A trend comparison needs at least two saved weigh-ins.
                  </p>
                ) : null}
              </section>

              <section
                aria-labelledby="saved-weigh-ins-title"
                className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                      Private history
                    </p>
                    <h2
                      className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
                      id="saved-weigh-ins-title"
                    >
                      Recent weigh-ins
                    </h2>
                  </div>
                  <StatusPill>Notes visible only to you</StatusPill>
                </div>
                {data.flow.historyTrend.history.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-600">
                    Saved entries will appear here after your first check-in.
                  </p>
                ) : (
                  <div
                    aria-label="Scrollable saved weigh-in table"
                    className="mt-5 overflow-x-auto rounded-xl border border-stone-200"
                    tabIndex={0}
                  >
                    <table
                      aria-label="Your saved personal weigh-ins"
                      className="w-full min-w-[42rem] border-collapse text-left text-sm"
                    >
                      <thead className="bg-stone-50 text-slate-700">
                        <tr>
                          <th className="px-4 py-3 font-semibold" scope="col">
                            Date
                          </th>
                          <th className="px-4 py-3 font-semibold" scope="col">
                            Weight
                          </th>
                          <th className="px-4 py-3 font-semibold" scope="col">
                            Change since previous saved entry
                          </th>
                          <th className="px-4 py-3 font-semibold" scope="col">
                            Private note
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {data.flow.historyTrend.history.map((weighIn) => {
                          const dailyChange = calculateDailyWeightChange(
                            data.weighIns,
                            data.participant.id,
                            weighIn.date,
                          )

                          return (
                            <tr
                              className="align-top text-slate-800"
                              key={`${weighIn.participantId}-${weighIn.date}`}
                            >
                              <td className="whitespace-nowrap px-4 py-3">
                                <time dateTime={weighIn.date}>
                                  {formatDate(weighIn.date)}
                                </time>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-semibold">
                                {formatWeight(weighIn.weightKg)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                {dailyChange === null
                                  ? '—'
                                  : formatChange(dailyChange)}
                              </td>
                              <td className="min-w-52 px-4 py-3">
                                {weighIn.note?.trim() || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {data.challenge.kind === 'group' ? (
                <section
                  aria-labelledby="group-history-title"
                  className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-7"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                      className="text-lg font-bold text-slate-800"
                      id="group-history-title"
                    >
                      Shared group weigh-ins
                    </h2>
                    <StatusPill>Opted-in dates and weights only</StatusPill>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Active members and the challenge owner can see entries each
                    participant chose to share. Notes are never shown here.
                  </p>
                  {groupHistory?.challengeId !== data.challenge.id ||
                  groupHistory.state === 'loading' ? (
                    <p className="mt-4 text-sm text-slate-600" role="status">
                      Loading shared group weigh-ins…
                    </p>
                  ) : groupHistory.state === 'error' ? (
                    <p className="mt-4 text-sm text-red-700" role="status">
                      Shared group history is unavailable right now.
                    </p>
                  ) : groupHistory.entries.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">
                      No entries have been shared with this group.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200">
                      <table
                        aria-label="Shared group weigh-ins"
                        className="w-full min-w-[34rem] border-collapse text-left text-sm"
                      >
                        <thead className="bg-stone-50 text-slate-700">
                          <tr>
                            <th className="px-4 py-3 font-semibold" scope="col">
                              Member
                            </th>
                            <th className="px-4 py-3 font-semibold" scope="col">
                              Date
                            </th>
                            <th className="px-4 py-3 font-semibold" scope="col">
                              Weight
                            </th>
                            <th className="px-4 py-3 font-semibold" scope="col">
                              Change since previous shared entry
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {groupHistory.entries.map((entry, index) => (
                            <tr
                              className="text-slate-800"
                              key={`${entry.displayName}-${entry.date}-${index}`}
                            >
                              <td className="px-4 py-3">{entry.displayName}</td>
                              <td className="px-4 py-3">
                                <time dateTime={entry.date}>
                                  {formatDate(entry.date)}
                                </time>
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatWeight(entry.weightKg)}
                              </td>
                              <td className="px-4 py-3">
                                {entry.changeSincePreviousKg === null
                                  ? '—'
                                  : formatChange(entry.changeSincePreviousKg)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}
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
    <section
      className="mx-auto w-full max-w-6xl space-y-6"
      aria-labelledby="goals-title"
    >
      <WeightPageHeader>
        <PageHeader
          description="Your personal starting weight, target, and milestones for the selected challenge."
          title="Goals"
          titleId="goals-title"
        >
          <StatusPill>{challengeContextName(data?.challenge)}</StatusPill>
        </PageHeader>
      </WeightPageHeader>
      <Card className="p-5 sm:p-8 lg:p-10">
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
              personalGoal={{
                currentWeightKg: data.flow.dashboard.currentWeightKg,
                remainingWeightKg: data.flow.dashboard.remainingTargetWeightKg,
                startingWeightKg: data.flow.dashboard.startingWeightKg,
                statusLabel: data.flow.progressSummary.statusLabel,
                targetWeightKg: data.flow.dashboard.targetWeightKg,
              }}
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

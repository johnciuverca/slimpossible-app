import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Card, PageHeader, ProgressBar, StatusPill } from '../components/ui'
import { MilestoneProgress } from '../components/MilestoneProgress'
import type { ParticipantMilestones } from '../models/participantMilestones'
import { createParticipantMilestones } from '../models/participantMilestones'
import {
  createParticipantDashboardFlow,
  type ParticipantDashboardFlow,
} from '../models/participantDashboardFlow'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'
import type { Participant } from '../models/participant'
import type { WeighIn } from '../models/weighIn'

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
  weighIns: WeighIn[]
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

  useEffect(() => {
    let isCurrent = true

    async function loadDashboard() {
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
      const challenge =
        savedChallenges.find(({ id }) => id === challengeParam) ??
        savedChallenges[0]
      if (!challenge) {
        setData(null)
        setMessage('Set up a challenge before viewing your dashboard.')
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
      const participant = participants.data.find(
        (candidate) =>
          candidate.challengeId === challenge.id &&
          candidate.status === 'active',
      )
      if (!participant) {
        setData(null)
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

  return { data, isLoading, message }
}

function DashboardState({
  children,
  isLoading,
  message,
}: {
  children: ReactNode
  isLoading: boolean
  message: string
}) {
  if (isLoading) {
    return (
      <p aria-live="polite" className="text-sm text-slate-600" role="status">
        Loading your saved dashboard…
      </p>
    )
  }
  if (message) {
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
                <ul className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Today', '/today'],
                    ['Progress', '/progress'],
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
  const { data, isLoading, message } = usePersonalDashboard()
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
        <DashboardState isLoading={isLoading} message={message}>
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

export function ProgressPage() {
  const { data, isLoading, message } = usePersonalDashboard()
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

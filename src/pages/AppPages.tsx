import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  ProgressBar,
  StatusPill,
} from '../components/ui'
import { MilestoneProgress } from '../components/MilestoneProgress'
import type { ParticipantMilestones } from '../models/participantMilestones'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'

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
        await persistence.repositories.challenges.listOwned(ownerId)
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
  return (
    <PlaceholderPage
      description="Your daily challenge space will live here."
      title="Today"
    >
      <Button disabled>Coming soon</Button>
      <Link
        className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline"
        to="/weigh-ins"
      >
        Record a weigh-in
      </Link>
    </PlaceholderPage>
  )
}

export function ProgressPage() {
  return (
    <PlaceholderPage
      description="Your progress history will live here."
      title="Progress"
    >
      <ProgressBar label="Progress preview" value={0} />
    </PlaceholderPage>
  )
}

export function GoalsPage() {
  return (
    <PlaceholderPage
      description="A local preview of the milestone component for the future participant dashboard."
      title="Goals"
    >
      <MilestoneProgress milestones={milestonePreview} />
    </PlaceholderPage>
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

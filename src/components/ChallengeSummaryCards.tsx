import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Card, FeedbackPanel, ProgressBar, StatusPill } from './ui'
import {
  mostRecentSunday,
  type GroupProgressSummary,
} from '../models/groupProgress'
import { createParticipantDashboardFlow } from '../models/participantDashboardFlow'
import { personalWeighInToday } from '../models/personalWeighIn'

export function ChallengeSummaryCards({
  workspace,
}: {
  workspace: PersonalWorkspace
}) {
  const { contexts, personal, persistence, userId } = workspace
  const key = `${contexts.key}:${personal.key}`
  const [summaries, setSummaries] = useState<{
    key: string
    data: Record<string, GroupProgressSummary | null>
    loading: boolean
  }>({ key: '', data: {}, loading: true })
  useEffect(() => {
    let current = true
    if (contexts.state !== 'ready' || persistence.mode === 'unavailable') return
    const groups = contexts.data.challenges.filter(
      (challenge) =>
        challenge.kind === 'group' &&
        ['draft', 'active'].includes(challenge.status),
    )
    setSummaries({ key, data: {}, loading: true })
    void Promise.all(
      groups.map(async (challenge) => {
        if (persistence.mode !== 'remote') return [challenge.id, null] as const
        try {
          const result =
            await persistence.repositories.groupProgress.getForChallenge(
              challenge.id,
              mostRecentSunday(),
            )
          return [
            challenge.id,
            result.state === 'success' ? result.data : null,
          ] as const
        } catch {
          return [challenge.id, null] as const
        }
      }),
    ).then((rows) => {
      if (current)
        setSummaries({ key, data: Object.fromEntries(rows), loading: false })
    })
    return () => {
      current = false
    }
  }, [contexts, key, persistence])
  const challenges = contexts.data.challenges.filter(
    ({ status }) => status === 'draft' || status === 'active',
  )
  return (
    <section aria-labelledby="personal-challenges-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="personal-challenges-title" className="text-2xl font-extrabold">
          Your challenges
        </h2>
        <Link
          className="text-sm font-semibold text-forest-800 underline"
          to="/challenge/setup"
        >
          Set up a challenge
        </Link>
      </div>
      <p className="text-sm text-ink-muted">
        Optional, separate contexts. Personal history never depends on joining
        one. Group progress uses only explicitly shared entries.
      </p>
      {contexts.state === 'loading' ? (
        <FeedbackPanel tone="loading">
          Loading optional challenges…
        </FeedbackPanel>
      ) : contexts.state === 'error' ? (
        <FeedbackPanel tone="error">{contexts.error}</FeedbackPanel>
      ) : challenges.length === 0 ? (
        <FeedbackPanel tone="empty">
          No active challenges. You can keep recording your personal weight
          without one.
        </FeedbackPanel>
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2"
          aria-label="Separate challenge summaries"
        >
          {challenges.map((challenge) => {
            const participant = contexts.data.participants.find(
              (row) =>
                row.userId === userId &&
                row.challengeId === challenge.id &&
                row.status === 'active',
            )
            const groupSummary =
              summaries.key === key ? summaries.data[challenge.id] : null
            const records = personal.data
              .filter(
                (entry) =>
                  entry.date <= personalWeighInToday() &&
                  (challenge.kind === 'personal' ||
                    entry.sharedChallengeIds.includes(challenge.id)),
              )
              .map((entry) => ({
                date: entry.date,
                weightKg: entry.weightKg,
                participantId: participant?.id ?? '',
              }))
            const flow =
              participant && personal.state === 'ready'
                ? createParticipantDashboardFlow({
                    challenge,
                    participantId: participant.id,
                    participants: [participant],
                    weighIns: records,
                  })
                : null
            const percentage =
              challenge.kind === 'group'
                ? groupSummary?.averageCompletionPercentage
                : flow?.dashboard.completionPercentage
            return (
              <li key={challenge.id}>
                <Card className="h-full space-y-4 p-5">
                  <StatusPill>
                    {challenge.kind === 'personal'
                      ? 'Personal challenge'
                      : 'Group challenge'}{' '}
                    · {challenge.status}
                  </StatusPill>
                  <h3 className="break-words text-xl font-bold">
                    {challenge.name}
                  </h3>
                  <p className="text-sm text-ink-muted">
                    {challenge.startDate}–{challenge.endDate}
                  </p>
                  {typeof percentage === 'number' ? (
                    <>
                      <p className="text-sm font-semibold">
                        {Math.round(percentage)}%{' '}
                        {challenge.kind === 'group'
                          ? 'average group completion'
                          : 'challenge goal completion'}
                      </p>
                      <ProgressBar
                        label={`${challenge.name} completion`}
                        value={percentage}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-ink-muted" role="status">
                      {challenge.kind === 'group' &&
                      (summaries.key !== key || summaries.loading)
                        ? 'Loading shared progress…'
                        : 'No authorized progress summary is available yet.'}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm font-semibold text-forest-800">
                    <Link
                      className="underline"
                      to={`/progress?challenge=${encodeURIComponent(challenge.id)}`}
                    >
                      Challenge progress: {challenge.name}
                    </Link>
                    {challenge.kind === 'group' ? (
                      <Link
                        className="underline"
                        to={`/group?challenge=${encodeURIComponent(challenge.id)}`}
                      >
                        Group summary
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

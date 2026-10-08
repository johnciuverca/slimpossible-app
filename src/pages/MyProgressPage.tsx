import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
} from '../components/ui'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import { RecordWeightDialog } from '../components/RecordWeightDialog'
import { PersonalWeightRecordCard } from '../components/PersonalWeightRecordCard'
import { ChallengeSummaryCards } from '../components/ChallengeSummaryCards'
import {
  personalHistory,
  formatPersonalChange,
  formatPersonalWeight,
} from '../models/personalHistory'
import {
  personalWeighInToday,
  type PersonalWeighIn,
} from '../models/personalWeighIn'
import { ProgressPage } from './AppPages'

export function MyProgressPage() {
  const [params] = useSearchParams()
  // Explicit legacy challenge links remain a distinct view, never a prerequisite.
  if (params.has('challenge'))
    return (
      <div className="w-full space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold">Challenge progress</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This is a selected challenge view, separate from your personal
            history.
          </p>
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-forest-800 underline"
            to="/progress"
          >
            Back to My Progress
          </Link>
        </header>
        <ProgressPage />
      </div>
    )
  return <PersonalHistoryPage />
}

function PersonalHistoryPage() {
  const workspace = usePersonalWorkspace()
  const owner = useRef(workspace.ownerKey)
  owner.current = workspace.ownerKey
  const [editor, setEditor] = useState<{
    key: string
    entry?: PersonalWeighIn
  } | null>(null)
  const [notice, setNotice] = useState<{
    key: string
    message: string
    error?: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<{ key: string; id: string } | null>(
    null,
  )
  const { history, changeKg } = personalHistory(
    workspace.personal.data,
    personalWeighInToday(),
  )
  useEffect(() => {
    setEditor(null)
    setNotice(null)
    setDeleting(null)
  }, [workspace.ownerKey])

  async function deleteEntry(entry: PersonalWeighIn) {
    if (
      !window.confirm(
        `Delete ${formatPersonalWeight(entry.weightKg)} recorded ${entry.date}? Its group shares will also be removed.`,
      ) ||
      workspace.persistence.mode === 'unavailable'
    )
      return
    const key = workspace.ownerKey
    setDeleting({ key, id: entry.id })
    try {
      const result =
        await workspace.persistence.repositories.personalWeighIns.delete(
          workspace.userId,
          entry.id,
        )
      if (owner.current !== key) return
      setDeleting(null)
      if (result.state !== 'success' || !result.data) {
        setNotice({
          key,
          error: true,
          message:
            'Deletion could not be confirmed. Your displayed history has not been changed; refresh or try again.',
        })
        return
      }
      setNotice({
        key,
        message:
          'Entry and linked group shares deleted. Your personal and challenge summaries are refreshing.',
      })
      workspace.refresh()
    } catch {
      if (owner.current === key) {
        setDeleting(null)
        setNotice({
          key,
          error: true,
          message: 'Deletion could not be confirmed. Try again.',
        })
      }
    }
  }

  return (
    <section
      aria-labelledby="my-progress-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="My Progress"
          titleId="my-progress-title"
          description="Your complete personal weight history. Challenges are optional, separate views."
        />
        <Button
          disabled={workspace.personal.state !== 'ready'}
          onClick={() => setEditor({ key: workspace.ownerKey })}
        >
          Record weight
        </Button>
      </header>
      {notice?.key === workspace.ownerKey ? (
        <FeedbackPanel tone={notice.error ? 'error' : 'info'}>
          {notice.message}
        </FeedbackPanel>
      ) : null}
      {workspace.personal.state === 'loading' ? (
        <FeedbackPanel tone="loading">
          Loading your personal history…
        </FeedbackPanel>
      ) : workspace.personal.state === 'error' ? (
        <FeedbackPanel tone="error">{workspace.personal.error}</FeedbackPanel>
      ) : (
        <>
          <Card className="min-w-0 p-6">
            <h2 className="text-xl font-bold">Your personal trend</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Every plotted point is a saved personal entry. No missing dates
              are filled in. This is not a group ranking or a challenge
              baseline.
            </p>
            {history.length ? (
              <PersonalProgressChart
                weighIns={history.map((entry) => ({
                  date: entry.date,
                  weightKg: entry.weightKg,
                  participantId: workspace.userId,
                }))}
              />
            ) : (
              <FeedbackPanel className="mt-4" tone="empty">
                No personal entries yet. Record your first weight without
                setting up a challenge.
              </FeedbackPanel>
            )}
            {changeKg !== null ? (
              <p className="mt-4 font-semibold">
                First-to-latest change: {formatPersonalChange(changeKg)} (
                {history.at(-1)!.date}–{history[0].date}).
              </p>
            ) : null}
          </Card>
          <Card className="min-w-0 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Personal history</h2>
              <StatusPill>Notes visible only to you</StatusPill>
            </div>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                No entries saved yet.
              </p>
            ) : (
              <ul
                className="mt-5 grid gap-4 md:grid-cols-2"
                aria-label="Your saved personal weigh-ins"
              >
                {history.map((entry) => (
                  <PersonalWeightRecordCard
                    key={entry.id}
                    entry={entry}
                    groupName={(id) =>
                      workspace.contexts.data.challenges.find(
                        (row) => row.id === id,
                      )?.name ?? 'an unavailable group'
                    }
                    onEdit={() => setEditor({ key: workspace.ownerKey, entry })}
                    onDelete={() => void deleteEntry(entry)}
                    disabled={deleting?.key === workspace.ownerKey}
                    deleting={
                      deleting?.key === workspace.ownerKey &&
                      deleting.id === entry.id
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <Button variant="secondary" onClick={workspace.refresh}>
        Refresh My Progress
      </Button>
      <ChallengeSummaryCards workspace={workspace} />
      <div className="flex flex-wrap gap-5 text-sm font-semibold text-forest-800">
        <Link
          className="inline-flex min-h-11 items-center underline"
          to="/dashboard"
        >
          Back to Dashboard
        </Link>
        <Link
          className="inline-flex min-h-11 items-center underline"
          to="/weigh-ins"
        >
          Full weigh-in page
        </Link>
      </div>
      {editor?.key === workspace.ownerKey ? (
        <RecordWeightDialog
          key={`${editor.key}:${editor.entry?.id ?? 'new'}`}
          workspace={workspace}
          entry={editor.entry}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setNotice({
              key: workspace.ownerKey,
              message:
                'Personal weight saved. Your history and challenge summaries are refreshing.',
            })
            workspace.refresh()
          }}
        />
      ) : null}
    </section>
  )
}

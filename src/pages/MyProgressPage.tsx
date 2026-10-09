import { useEffect, useState } from 'react'
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
import { DeleteWeightDialog } from '../components/DeleteWeightDialog'
import {
  WeightPageHeader,
  RecordWeightAction,
} from '../components/WeightPageHeader'
import { PersonalWeightRecordCard } from '../components/PersonalWeightRecordCard'
import { ChallengeSummaryCards } from '../components/ChallengeSummaryCards'
import {
  personalHistory,
  formatPersonalChange,
} from '../models/personalHistory'
import {
  personalWeighInToday,
  type PersonalWeighIn,
} from '../models/personalWeighIn'
import { ProgressPage } from './AppPages'

export function MyProgressPage() {
  const [params] = useSearchParams()
  // Explicit legacy challenge links remain a distinct view, never a prerequisite.
  if (params.has('challenge')) return <ProgressPage personalHeader />
  return <PersonalHistoryPage />
}

function PersonalHistoryPage() {
  const workspace = usePersonalWorkspace()
  const [editor, setEditor] = useState<{
    key: string
    entry?: PersonalWeighIn
  } | null>(null)
  const [notice, setNotice] = useState<{
    key: string
    message: string
    error?: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<{
    key: string
    entry: PersonalWeighIn
  } | null>(null)
  const { history, changeKg } = personalHistory(
    workspace.personal.data,
    personalWeighInToday(),
  )
  useEffect(() => {
    setEditor(null)
    setNotice(null)
    setDeleting(null)
  }, [workspace.ownerKey])

  return (
    <section
      aria-labelledby="my-progress-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <WeightPageHeader action={<RecordWeightAction workspace={workspace} />}>
        <PageHeader
          title="My Progress"
          titleId="my-progress-title"
          description="Your complete personal weight history. Challenges are optional, separate views."
        />
      </WeightPageHeader>
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
                    onDelete={() =>
                      setDeleting({ key: workspace.ownerKey, entry })
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
      {deleting?.key === workspace.ownerKey ? (
        <DeleteWeightDialog
          key={`${deleting.key}:${deleting.entry.id}`}
          workspace={workspace}
          entry={deleting.entry}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            setNotice({
              key: workspace.ownerKey,
              message:
                'Entry and linked group shares deleted. Your personal and challenge summaries are refreshing.',
            })
            workspace.refresh()
          }}
        />
      ) : null}
    </section>
  )
}

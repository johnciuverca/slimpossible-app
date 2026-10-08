import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
} from '../components/ui'
import { RecordWeightDialog } from '../components/RecordWeightDialog'
import { ChallengeSummaryCards } from '../components/ChallengeSummaryCards'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import {
  personalHistory,
  formatPersonalWeight,
  formatPersonalChange,
} from '../models/personalHistory'
import {
  personalWeighInToday,
  type PersonalWeighIn,
} from '../models/personalWeighIn'

export function PersonalDashboardPage() {
  const workspace = usePersonalWorkspace()
  const [editor, setEditor] = useState<{
    key: string
    entry?: PersonalWeighIn
  } | null>(null)
  const [message, setMessage] = useState<{ key: string; text: string } | null>(
    null,
  )
  const today = personalWeighInToday()
  const { latest } = personalHistory(workspace.personal.data, today)
  const recent = personalHistory(workspace.personal.data, today, 30)
  const todayEntry = workspace.personal.data.find(
    (entry) => entry.date === today,
  )
  const ready = workspace.personal.state === 'ready'
  useEffect(() => {
    setEditor(null)
    setMessage(null)
  }, [workspace.ownerKey])
  return (
    <section
      aria-labelledby="dashboard-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Dashboard"
          titleId="dashboard-title"
          description="Your personal home. Track weight and progress with or without a challenge."
        />
        <Button
          disabled={!ready}
          onClick={() =>
            setEditor({
              key: workspace.ownerKey,
              ...(todayEntry ? { entry: todayEntry } : {}),
            })
          }
        >
          {todayEntry ? 'Edit today’s weight' : 'Record weight'}
        </Button>
      </header>
      {message?.key === workspace.ownerKey ? (
        <p role="status" className="text-sm text-forest-800">
          {message.text}
        </p>
      ) : null}
      {workspace.personal.state === 'loading' ? (
        <FeedbackPanel tone="loading">
          Loading your personal Dashboard…
        </FeedbackPanel>
      ) : workspace.personal.state === 'error' ? (
        <FeedbackPanel tone="error">{workspace.personal.error}</FeedbackPanel>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Card className="space-y-4 p-6">
              <h2 className="text-lg font-bold">Latest personal weight</h2>
              <p className="text-4xl font-extrabold tracking-tight">
                {latest
                  ? formatPersonalWeight(latest.weightKg)
                  : 'No record yet'}
              </p>
              {latest ? (
                <time
                  className="block text-sm text-ink-muted"
                  dateTime={latest.date}
                >
                  Recorded {latest.date}
                </time>
              ) : (
                <p className="text-sm text-ink-muted">
                  Your first personal entry can be saved without creating or
                  joining a challenge.
                </p>
              )}
              <StatusPill>
                {todayEntry ? 'Logged today' : 'Not logged today'}
              </StatusPill>
              <p className="text-sm text-ink-muted">
                {todayEntry
                  ? 'Today’s entry is already saved. Corrections update that same entry.'
                  : 'No entry for today yet. Your last saved weight is not a check-in for today.'}
              </p>
              <Link
                className="inline-flex min-h-11 items-center text-sm font-bold text-forest-800 underline"
                to="/progress"
              >
                My Progress and private history
              </Link>
            </Card>
            <Card className="min-w-0 p-6">
              <h2 className="text-lg font-bold">Your last 30 days</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Only real saved dates and weights. Missing days are not
                estimated.
              </p>
              {recent.history.length ? (
                <PersonalProgressChart
                  weighIns={recent.history.map((entry) => ({
                    date: entry.date,
                    weightKg: entry.weightKg,
                    participantId: workspace.userId,
                  }))}
                />
              ) : (
                <FeedbackPanel className="mt-5" tone="empty">
                  No saved entries in the last 30 days. Your trend will appear
                  after a check-in.
                </FeedbackPanel>
              )}
              {recent.changeKg !== null ? (
                <p className="mt-4 text-sm font-semibold">
                  Change between {recent.history.at(-1)!.date} and{' '}
                  {recent.latest!.date}: {formatPersonalChange(recent.changeKg)}
                  .
                </p>
              ) : recent.history.length === 1 ? (
                <p className="mt-4 text-sm text-ink-muted">
                  Two saved entries are needed to compare a trend.
                </p>
              ) : null}
            </Card>
          </div>
        </>
      )}
      <Button variant="secondary" onClick={workspace.refresh}>
        Refresh Dashboard
      </Button>
      <ChallengeSummaryCards workspace={workspace} />
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800 underline"
        to="/weigh-ins"
      >
        Open full weigh-in page
      </Link>
      {editor?.key === workspace.ownerKey ? (
        <RecordWeightDialog
          key={`${editor.key}:${editor.entry?.id ?? 'new'}`}
          workspace={workspace}
          entry={editor.entry}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            setMessage({
              key: workspace.ownerKey,
              text: 'Personal weight saved. Your Dashboard and challenge summaries are refreshing.',
            })
            workspace.refresh()
          }}
        />
      ) : null}
    </section>
  )
}

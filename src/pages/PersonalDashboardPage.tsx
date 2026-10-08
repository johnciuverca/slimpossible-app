import { Link } from 'react-router-dom'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  Button,
  Card,
  FeedbackPanel,
  PageHeader,
  StatusPill,
} from '../components/ui'
import {
  WeightPageHeader,
  RecordWeightAction,
} from '../components/WeightPageHeader'
import { ChallengeSummaryCards } from '../components/ChallengeSummaryCards'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import {
  personalHistory,
  formatPersonalWeight,
  formatPersonalChange,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'

export function PersonalDashboardPage() {
  const workspace = usePersonalWorkspace()
  const today = personalWeighInToday()
  const { latest } = personalHistory(workspace.personal.data, today)
  const recent = personalHistory(workspace.personal.data, today, 30)
  const todayEntry = workspace.personal.data.find(
    (entry) => entry.date === today,
  )
  return (
    <section
      aria-labelledby="dashboard-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <WeightPageHeader action={<RecordWeightAction workspace={workspace} />}>
        <PageHeader
          title="Dashboard"
          titleId="dashboard-title"
          description="Your personal home. Track weight and progress with or without a challenge."
        />
      </WeightPageHeader>
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
    </section>
  )
}

import type { ReactNode } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Button, Card, FeedbackPanel } from '../components/ui'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import {
  personalHistory,
  formatPersonalChange,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'

export function PersonalHistoryContent({
  workspace,
  referenceWeightKg,
  referenceLabel,
  children,
}: {
  workspace: PersonalWorkspace
  referenceWeightKg?: number
  referenceLabel?: string
  children?: ReactNode
}) {
  const { history, changeKg } = personalHistory(
    workspace.personal.data,
    personalWeighInToday(),
  )

  return (
    <div className="space-y-4">
      {workspace.personal.state === 'loading' ? (
        <FeedbackPanel tone="loading">
          Loading your personal progress…
        </FeedbackPanel>
      ) : workspace.personal.state === 'error' ? (
        <FeedbackPanel tone="error">{workspace.personal.error}</FeedbackPanel>
      ) : (
        <Card className="min-w-0 p-4">
          <h2 className="text-lg font-bold">Your personal trend</h2>
          <p className="sr-only">
            Every plotted point is a saved personal entry. No missing dates are
            filled in. This is not a group ranking or a challenge baseline.
          </p>
          {history.length ? (
            <PersonalProgressChart
              referenceWeightKg={referenceWeightKg}
              referenceLabel={referenceLabel}
              weighIns={history.map((entry) => ({
                date: entry.date,
                weightKg: entry.weightKg,
                participantId: workspace.userId,
              }))}
            />
          ) : (
            <FeedbackPanel className="mt-4" tone="empty">
              No personal entries yet.
            </FeedbackPanel>
          )}
          {changeKg !== null ? (
            <p className="mt-3 font-semibold">
              First-to-latest change: {formatPersonalChange(changeKg)} (
              {history.at(-1)!.date}–{history[0].date}).
            </p>
          ) : null}
        </Card>
      )}
      {children}
      <Button variant="secondary" onClick={workspace.refresh}>
        Refresh Dashboard
      </Button>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Button, Card, FeedbackPanel } from '../components/ui'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import {
  personalHistory,
  formatPersonalChange,
} from '../models/personalHistory'
import { personalWeighInToday } from '../models/personalWeighIn'
import { RecordWeightDialog } from '../components/RecordWeightDialog'

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
  const [selectedChartPoint, setSelectedChartPoint] = useState<{
    date: string
    value: number
    estimated?: boolean
  } | null>(null)
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
            Solid points are saved personal entries. Hollow estimated points
            appear only between saved dates, are visual only, and are not a
            group ranking or a challenge baseline.
          </p>
          {history.length ? (
            <PersonalProgressChart
              fitContainer
              labelExtremesOnly
              referenceWeightKg={referenceWeightKg}
              referenceLabel={referenceLabel}
              weighIns={history.map((entry) => ({
                date: entry.date,
                weightKg: entry.weightKg,
                participantId: workspace.userId,
              }))}
              onPointActivate={(point) => setSelectedChartPoint(point)}
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
      {selectedChartPoint && workspace.personal.state === 'ready'
        ? (() => {
            const selectedChartDate = selectedChartPoint.date
            const entry = workspace.personal.data.find(
              (item) => item.date === selectedChartDate,
            )
            const estimated = selectedChartPoint.estimated
            return entry || estimated ? (
              <RecordWeightDialog
                key={`chart:${selectedChartDate}:${entry?.id ?? 'new'}`}
                workspace={workspace}
                entry={entry}
                initialValues={
                  entry
                    ? undefined
                    : {
                        date: selectedChartDate,
                        weightKg: String(selectedChartPoint.value),
                      }
                }
                estimateNotice={
                  entry ? undefined : 'This is a display-only estimate.'
                }
                onClose={() => setSelectedChartPoint(null)}
                onSaved={() => {
                  setSelectedChartPoint(null)
                  workspace.refresh()
                }}
              />
            ) : null
          })()
        : null}
      <Button variant="secondary" onClick={workspace.refresh}>
        Refresh Dashboard
      </Button>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Button, Card, FeedbackPanel, StatusPill } from '../components/ui'
import { PersonalProgressChart } from '../components/PersonalProgressChart'
import { RecordWeightDialog } from '../components/RecordWeightDialog'
import { DeleteWeightDialog } from '../components/DeleteWeightDialog'
import { PersonalWeightRecordActions } from '../components/PersonalWeightRecordCard'
import {
  personalHistory,
  formatPersonalChange,
  formatPersonalWeight,
} from '../models/personalHistory'
import {
  personalWeighInToday,
  type PersonalWeighIn,
} from '../models/personalWeighIn'
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
  const sharingLabel = (entry: PersonalWeighIn) => {
    const ids = entry.sharedChallengeIds
    if (workspace.contexts.state === 'loading')
      return `Shared with ${ids.length} ${ids.length === 1 ? 'group' : 'groups'} (loading names)`
    if (workspace.contexts.state === 'error')
      return `Shared with ${ids.length} ${ids.length === 1 ? 'group' : 'groups'} (names could not be loaded)`
    return `Shared with ${ids
      .map(
        (id) =>
          workspace.contexts.data.challenges.find((row) => row.id === id)
            ?.name ?? 'an unavailable group',
      )
      .join(', ')}`
  }
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
    <div className="space-y-6">
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
        </>
      )}
      {children}
      {workspace.personal.state === 'ready' ? (
        <>
          <Card className="min-w-0 p-6" id="personal-history">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Personal history</h2>
              <StatusPill>Notes visible only to you</StatusPill>
            </div>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                No entries saved yet.
              </p>
            ) : (
              <>
                <p
                  id="personal-history-scroll-hint"
                  className="mt-4 text-sm text-ink-muted sm:hidden"
                >
                  Scroll sideways for sharing details and Edit/Delete actions.
                </p>
                <div
                  className="mt-5 overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-forest-700"
                  role="region"
                  aria-label="Personal history table"
                  aria-describedby="personal-history-scroll-hint"
                  tabIndex={0}
                >
                  <table
                    className="w-full text-left text-sm"
                    aria-label="Your saved personal weigh-ins"
                  >
                    <thead>
                      <tr className="border-b border-line text-ink-muted">
                        {[
                          'Date',
                          'Weight',
                          'Private note',
                          'Sharing',
                          'Actions',
                        ].map((label) => (
                          <th key={label} scope="col" className="px-3 py-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-line align-top"
                        >
                          <th
                            scope="row"
                            className="px-3 py-4 whitespace-nowrap font-medium"
                          >
                            <time dateTime={entry.date}>{entry.date}</time>
                          </th>
                          <td className="px-3 py-4 whitespace-nowrap font-bold">
                            {formatPersonalWeight(entry.weightKg)}
                          </td>
                          <td className="min-w-36 max-w-xs px-3 py-4 whitespace-pre-wrap break-words">
                            {entry.note || '—'}
                          </td>
                          <td className="min-w-32 max-w-xs px-3 py-4 break-words">
                            {entry.sharedChallengeIds.length
                              ? sharingLabel(entry)
                              : 'Private'}
                          </td>
                          <td className="px-3 py-2">
                            <PersonalWeightRecordActions
                              entry={entry}
                              onEdit={() =>
                                setEditor({ key: workspace.ownerKey, entry })
                              }
                              onDelete={() =>
                                setDeleting({ key: workspace.ownerKey, entry })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      ) : null}
      <Button variant="secondary" onClick={workspace.refresh}>
        Refresh Dashboard
      </Button>
      <div className="flex flex-wrap gap-5 text-sm font-semibold text-forest-800">
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
    </div>
  )
}

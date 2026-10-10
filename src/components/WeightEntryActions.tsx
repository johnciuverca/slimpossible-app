import { useState } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import { RecordWeightDialog } from './RecordWeightDialog'
import { DeleteWeightDialog } from './DeleteWeightDialog'
import { Button } from './ui'

/** Only resolves records from the current author's authorized personal workspace. */
export function WeightEntryActions({
  workspace,
  date,
  compact = false,
  memberLabel,
  requiredSharedChallengeId,
}: {
  workspace: PersonalWorkspace
  date: string
  compact?: boolean
  memberLabel?: string
  requiredSharedChallengeId?: string
}) {
  const [selection, setSelection] = useState<{
    key: string
    action: 'edit' | 'delete'
  } | null>(null)
  const entry =
    workspace.personal.state === 'ready'
      ? workspace.personal.data.find(
          (row) =>
            row.date === date &&
            (!requiredSharedChallengeId ||
              row.sharedChallengeIds.includes(requiredSharedChallengeId)),
        )
      : undefined
  if (!entry) return null
  const action = selection?.key === workspace.ownerKey ? selection.action : null
  const close = () => setSelection(null)
  const changed = () => {
    close()
    workspace.refresh()
  }
  return (
    <>
      <div
        className={
          compact
            ? 'inline-flex w-[90px] shrink-0 flex-nowrap items-center justify-end gap-0.5'
            : 'flex flex-wrap gap-2'
        }
      >
        <Button
          variant={compact ? 'ghost' : 'secondary'}
          className={
            compact
              ? 'h-9 w-11 shrink-0 p-0! text-forest-800! sm:h-8 pointer-coarse:h-11'
              : undefined
          }
          aria-label={`Edit weight ${date}${memberLabel ? ` for ${memberLabel}` : ''}`}
          onClick={() =>
            setSelection({ key: workspace.ownerKey, action: 'edit' })
          }
        >
          {compact ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m16 3 5 5-12 12-6 1 1-6Z" />
              <path d="m14 5 5 5" />
            </svg>
          ) : (
            'Edit'
          )}
        </Button>
        <Button
          variant={compact ? 'ghost' : 'secondary'}
          className={
            compact
              ? 'h-9 w-11 shrink-0 p-0! text-danger-800! sm:h-8 pointer-coarse:h-11'
              : undefined
          }
          aria-label={`Delete ${date}${memberLabel ? ` for ${memberLabel}` : ''}`}
          onClick={() =>
            setSelection({ key: workspace.ownerKey, action: 'delete' })
          }
        >
          {compact ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
            </svg>
          ) : (
            'Delete'
          )}
        </Button>
      </div>
      {action === 'edit' ? (
        <RecordWeightDialog
          key={`${workspace.ownerKey}:${entry.id}`}
          workspace={workspace}
          entry={entry}
          onClose={close}
          onSaved={changed}
        />
      ) : null}
      {action === 'delete' ? (
        <DeleteWeightDialog
          key={`${workspace.ownerKey}:${entry.id}`}
          workspace={workspace}
          entry={entry}
          onClose={close}
          onDeleted={changed}
        />
      ) : null}
    </>
  )
}

export function PersonalEntryActions({
  challengeId,
}: {
  challengeId?: string
}) {
  const workspace = usePersonalWorkspace()
  if (workspace.personal.state !== 'ready')
    return (
      <p role="status">
        {workspace.personal.error || 'Loading your own entry actions…'}
      </p>
    )
  const entries = workspace.personal.data.filter(
    (entry) => !challengeId || entry.sharedChallengeIds.includes(challengeId),
  )
  return (
    <section
      className="rounded-2xl border border-line bg-panel p-5 sm:p-8"
      aria-label={
        challengeId
          ? 'Your entries shared with this group'
          : 'Your personal entry actions'
      }
    >
      <h2 className="text-xl font-bold">
        {challengeId
          ? 'Your entries shared with this group'
          : 'Your personal entry actions'}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        {challengeId
          ? 'Only your explicitly shared entries can be edited here. Notes stay private inside your editor.'
          : 'Edit or delete your own saved entries. Notes stay private inside your editor.'}
      </p>
      {entries.length === 0 ? (
        <p className="mt-4">
          No own entries{challengeId ? ' shared with this group' : ''}.
        </p>
      ) : null}
      <ul
        className="mt-4 space-y-3"
        aria-label={
          challengeId
            ? 'Your own shared group entries'
            : 'Your own personal entry actions'
        }
      >
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3"
          >
            <span>
              <time dateTime={entry.date}>{entry.date}</time> · {entry.weightKg}{' '}
              kg
            </span>
            <WeightEntryActions workspace={workspace} date={entry.date} />
          </li>
        ))}
      </ul>
    </section>
  )
}

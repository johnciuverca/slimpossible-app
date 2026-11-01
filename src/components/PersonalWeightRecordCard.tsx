import type { PersonalWeighIn } from '../models/personalWeighIn'
import { formatPersonalWeight } from '../models/personalHistory'
import { formatChartDate } from '../models/chartDate'

export function PersonalWeightRecordCard({
  entry,
  groupName,
  onEdit,
  onDelete,
  deleting = false,
  disabled = false,
}: {
  entry: PersonalWeighIn
  groupName: (id: string) => string
  onEdit: () => void
  onDelete: () => void
  deleting?: boolean
  disabled?: boolean
}) {
  return (
    <li className="min-w-0 rounded-xl border border-line bg-page p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-ink">
            {formatPersonalWeight(entry.weightKg)}
          </p>
          <time
            className="mt-1 block text-sm text-ink-muted"
            dateTime={entry.date}
          >
            {formatChartDate(entry.date)}
          </time>
        </div>
        <PersonalWeightRecordActions
          entry={entry}
          onEdit={onEdit}
          onDelete={onDelete}
          deleting={deleting}
          disabled={disabled}
        />
      </div>
      {entry.note ? (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm text-ink-muted">
          {entry.note}
        </p>
      ) : null}
      <p className="mt-3 break-words text-xs text-ink-muted">
        {entry.sharedChallengeIds.length
          ? `Shared with ${entry.sharedChallengeIds.map(groupName).join(', ')}`
          : 'Private'}
      </p>
      {deleting ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          Deleting entry and group shares…
        </p>
      ) : null}
    </li>
  )
}

export function PersonalWeightRecordActions({
  entry,
  onEdit,
  onDelete,
  deleting = false,
  disabled = false,
}: {
  entry: PersonalWeighIn
  onEdit: () => void
  onDelete: () => void
  deleting?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {(['edit', 'delete'] as const).map((action) => (
        <button
          key={action}
          type="button"
          aria-label={`${action === 'edit' ? 'Edit weight' : 'Delete'} ${entry.date}`}
          title={`${action === 'edit' ? 'Edit weight:' : 'Delete'} ${formatPersonalWeight(entry.weightKg)} recorded ${entry.date}`}
          disabled={disabled || deleting}
          onClick={action === 'edit' ? onEdit : onDelete}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-transparent transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:cursor-not-allowed disabled:opacity-50 ${action === 'delete' ? 'text-danger-800 hover:border-line hover:bg-panel' : 'text-forest-800 hover:border-line hover:bg-panel'}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {action === 'edit' ? (
              <>
                <path d="m16 3 5 5-12 12-6 1 1-6Z" />
                <path d="m14 5 5 5" />
              </>
            ) : (
              <>
                <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
              </>
            )}
          </svg>
        </button>
      ))}
    </div>
  )
}

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
    <li
      data-personal-weight-container=""
      className="min-h-16 min-w-0 rounded-xl border border-solid border-slate-700 bg-slate-800 p-1.5 text-slate-100 max-[600px]:min-h-[74px]"
    >
      <div
        data-personal-weight-row=""
        className="relative min-h-8 max-[600px]:min-h-11"
      >
        <time
          data-record-date=""
          className="absolute left-0 top-1/2 min-w-0 -translate-y-1/2 text-sm text-slate-300"
          dateTime={entry.date}
        >
          {formatChartDate(entry.date)}
        </time>
        <p
          data-personal-record-value=""
          className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-3xl font-bold tracking-tight text-slate-50"
        >
          {formatPersonalWeight(entry.weightKg)}
        </p>
        <div
          data-record-actions=""
          className="absolute right-0 top-1/2 -translate-y-1/2"
        >
          <PersonalWeightRecordActions
            entry={entry}
            onEdit={onEdit}
            onDelete={onDelete}
            deleting={deleting}
            disabled={disabled}
          />
        </div>
      </div>
      {entry.note ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
          {entry.note}
        </p>
      ) : null}
      <p className="mt-1 break-words text-xs text-slate-300">
        {entry.sharedChallengeIds.length
          ? `Shared with ${entry.sharedChallengeIds.map(groupName).join(', ')}`
          : 'Private'}
      </p>
      {deleting ? (
        <p role="status" className="mt-3 text-sm text-slate-300">
          Deleting entry and group shares…
        </p>
      ) : null}
    </li>
  )
}

export function EstimatedPersonalWeightRecordCard({
  date,
  weightKg,
  onRecord,
}: {
  date: string
  weightKg: number
  onRecord: () => void
}) {
  return (
    <li
      data-estimated-weigh-in=""
      className="flex min-h-16 min-w-0 items-center rounded-xl border border-dashed border-slate-700 bg-slate-800 p-1.5 text-slate-100 max-[600px]:min-h-[74px]"
    >
      <div
        data-personal-weight-row=""
        className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
      >
        <time
          data-record-date=""
          className="min-w-0 text-sm text-slate-300"
          dateTime={date}
        >
          {formatChartDate(date)}
        </time>
        <p
          data-personal-estimated-value=""
          className="inline-flex min-w-0 items-baseline justify-center gap-2 whitespace-nowrap text-center"
        >
          <span className="text-lg font-normal tracking-tight text-slate-100">
            {formatPersonalWeight(weightKg)}
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-slate-400">
            Estimated
          </span>
        </p>
        <div data-record-actions="" className="flex min-w-0 justify-end">
          <button
            type="button"
            aria-label={`Record estimated weight ${formatPersonalWeight(weightKg)} on ${date}`}
            onClick={onRecord}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/60 px-2 text-sm font-semibold text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
          >
            Record weight
          </button>
        </div>
      </div>
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

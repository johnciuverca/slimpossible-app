type GroupMemberProgressBarProps = {
  label: string
  percentage: number | null
  negativeProgressCapped?: boolean
}

export function GroupMemberProgressBar({
  label,
  percentage,
  negativeProgressCapped = false,
}: GroupMemberProgressBarProps) {
  const value =
    percentage === null || !Number.isFinite(percentage)
      ? null
      : Math.max(-100, Math.min(100, percentage))
  const cappedNegativeValue =
    value === -100 && (negativeProgressCapped || (percentage ?? 0) < -100)
  const valueText =
    value === null
      ? 'Unavailable'
      : cappedNegativeValue
        ? '≤ -100%'
        : `${value}%`

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={-100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={valueText}
      className="relative mt-3 h-3 overflow-hidden rounded-full bg-stone-200"
      role="progressbar"
    >
      {value !== null ? (
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 transition-[width] duration-300 ${value < 0 ? 'bg-red-600' : 'bg-emerald-600'}`}
          data-progress-fill
          style={{
            left: '50%',
            transform: value < 0 ? 'translateX(-100%)' : undefined,
            width: `${Math.abs(value) / 2}%`,
          }}
        />
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 z-10 w-px bg-slate-700"
        data-progress-baseline
      />
    </div>
  )
}

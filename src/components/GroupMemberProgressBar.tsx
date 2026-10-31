type GroupMemberProgressBarProps = {
  label: string
  percentage: number | null
}

export function GroupMemberProgressBar({
  label,
  percentage,
}: GroupMemberProgressBarProps) {
  const value =
    percentage === null || !Number.isFinite(percentage)
      ? null
      : Math.max(0, Math.min(100, percentage))

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'Unavailable' : `${value}%`}
      className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200"
      role="progressbar"
    >
      <span
        aria-hidden="true"
        className="block h-full rounded-full bg-emerald-600 transition-[width] duration-300"
        style={{ width: `${value ?? 0}%` }}
      />
    </div>
  )
}

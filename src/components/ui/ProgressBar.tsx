type ProgressBarProps = {
  label: string
  max?: number
  value: number
}

export function ProgressBar({ label, max = 100, value }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const safeValue = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), safeMax)
    : 0
  const percentage = (safeValue / safeMax) * 100

  return (
    <div
      aria-label={label}
      aria-valuemax={safeMax}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className="h-3 w-full overflow-hidden rounded-full bg-emerald-100 motion-reduce:transition-none"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-emerald-700 motion-safe:transition-[width] motion-reduce:transition-none"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

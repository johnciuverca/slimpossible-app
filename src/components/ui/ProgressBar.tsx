type ProgressBarProps = {
  label: string
  max?: number
  value: number
}

export function ProgressBar({ label, max = 100, value }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const safeValue = Math.min(Math.max(value, 0), safeMax)
  const percentage = (safeValue / safeMax) * 100

  return (
    <div
      aria-label={label}
      aria-valuemax={safeMax}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className="h-3 w-full overflow-hidden rounded-full bg-emerald-100"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-emerald-700 transition-[width]"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

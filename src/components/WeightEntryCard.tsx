import type { ReactNode } from 'react'

/** Shared compact weight label; actual rendered controls determine editable sizing. */
export function WeightEntryCard({
  weightKg,
  valueMarker,
  children,
  className = '',
  valueClassName = '',
  valueSizeClassName = '',
  valueFontScale = 60,
}: {
  weightKg: number
  valueMarker?: 'actual' | 'estimated'
  children?: ReactNode
  className?: string
  valueClassName?: string
  valueSizeClassName?: string
  valueFontScale?: number
}) {
  const label = weightKg.toFixed(2)
  return (
    <div
      className={`group/weight inline-flex h-10 shrink-0 flex-nowrap items-center gap-0 rounded-lg border border-line bg-page px-1 py-0 has-[button]:w-[124px] pointer-coarse:h-12 pointer-coarse:has-[button]:w-[148px] ${className}`}
    >
      <span
        className={`inline-flex shrink-0 items-baseline justify-end gap-0.5 whitespace-nowrap text-[10px] group-has-[button]/weight:w-[56px] ${valueClassName} ${valueSizeClassName}`}
        title={`${weightKg} kg`}
      >
        {valueMarker ? (
          <span
            aria-hidden="true"
            data-weight-marker={valueMarker}
            className={`inline-block size-1.5 shrink-0 self-center rounded-full ${valueMarker === 'actual' ? 'bg-current' : 'border border-current bg-transparent'}`}
          />
        ) : null}
        <span
          data-weight-value=""
          className="shrink-0 text-right tabular-nums group-has-[button]/weight:w-9"
          style={
            label.length > 6
              ? { fontSize: `${valueFontScale / label.length}px` }
              : undefined
          }
        >
          {label}
        </span>{' '}
        <span>kg</span>
      </span>
      {children}
    </div>
  )
}

import type { ReactNode } from 'react'

/** Shared compact weight label; actual rendered controls determine editable sizing. */
export function WeightEntryCard({
  weightKg,
  centerValue = false,
  children,
  className = '',
  valueClassName = '',
  valueSizeClassName = '',
  valueFontScale = 60,
}: {
  weightKg: number
  centerValue?: boolean
  children?: ReactNode
  className?: string
  valueClassName?: string
  valueSizeClassName?: string
  valueFontScale?: number
}) {
  const label = weightKg.toFixed(2)
  return (
    <div
      data-center-value={centerValue ? '' : undefined}
      className={`group/weight rounded-lg border border-line bg-page ${centerValue ? 'relative flex min-h-12 w-full flex-col items-stretch gap-1 px-1 py-1 pointer-coarse:min-h-[52px]' : 'inline-flex h-10 shrink-0 flex-nowrap items-center gap-0 px-1 py-0 has-[button]:w-[124px] pointer-coarse:h-12 pointer-coarse:has-[button]:w-[148px]'} ${className}`}
    >
      <span
        data-record-value=""
        className={`${centerValue ? 'flex w-full flex-1 items-center justify-center gap-1 whitespace-nowrap text-center' : 'inline-flex shrink-0 items-baseline justify-end gap-0.5 whitespace-nowrap text-[10px] group-has-[button]/weight:w-[56px]'} ${valueClassName} ${valueSizeClassName}`}
        title={`${weightKg} kg`}
      >
        <span
          data-weight-value=""
          className={`shrink-0 tabular-nums ${centerValue ? 'text-center' : 'text-right group-has-[button]/weight:w-9'}`}
          style={
            label.length > 6
              ? { fontSize: `${valueFontScale / label.length}px` }
              : undefined
          }
        >
          {label}
        </span>{' '}
        <span className={centerValue ? 'text-xs font-medium' : ''}>kg</span>
      </span>
      {centerValue ? (
        <div
          data-record-actions=""
          className="flex min-h-8 w-full items-center justify-end pointer-coarse:min-h-11"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

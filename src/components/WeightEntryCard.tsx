import type { ReactNode } from 'react'

/** Shared compact weight label; actual rendered controls determine editable sizing. */
export function WeightEntryCard({
  weightKg,
  children,
  className = '',
  valueClassName = '',
  secondaryContent,
}: {
  weightKg: number
  children?: ReactNode
  className?: string
  valueClassName?: string
  secondaryContent?: ReactNode
}) {
  const label = weightKg.toFixed(2)
  return (
    <div
      className={`group/weight inline-flex shrink-0 flex-nowrap rounded-lg border border-line bg-page px-1 has-[button]:w-[124px] pointer-coarse:has-[button]:w-[148px] ${secondaryContent ? 'h-auto flex-col items-center justify-center gap-0.5 py-1' : 'h-10 items-center gap-0 py-0 pointer-coarse:h-12'} ${className}`}
    >
      <div
        className={
          secondaryContent
            ? 'inline-flex w-full flex-nowrap items-center justify-center gap-0'
            : 'contents'
        }
      >
        <span
          className={`inline-flex shrink-0 items-baseline justify-end gap-0.5 whitespace-nowrap text-[10px] group-has-[button]/weight:w-[50px] ${valueClassName}`}
          title={`${weightKg} kg`}
        >
          <span
            className="text-right tabular-nums group-has-[button]/weight:w-9 group-not-has-[button]/weight:text-[10px]!"
            style={
              label.length > 6
                ? { fontSize: `${60 / label.length}px` }
                : undefined
            }
          >
            {label}
          </span>{' '}
          <span>kg</span>
        </span>{' '}
        {children}
      </div>
      {secondaryContent ? (
        <span className="block w-full text-center text-[10px] leading-tight">
          {secondaryContent}
        </span>
      ) : null}
    </div>
  )
}

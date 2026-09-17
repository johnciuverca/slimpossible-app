import type { HTMLAttributes, PropsWithChildren } from 'react'

type StatusPillProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: 'neutral' | 'success' | 'warning'
  }
>

const toneClasses = {
  neutral: 'bg-stone-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
}

export function StatusPill({
  children,
  className = '',
  tone = 'neutral',
  ...props
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${toneClasses[tone]} ${className}`}
      role="status"
      {...props}
    >
      {children}
    </span>
  )
}

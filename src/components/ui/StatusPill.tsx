import type { HTMLAttributes, PropsWithChildren } from 'react'

type StatusPillProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: 'neutral' | 'success' | 'warning'
  }
>

const toneClasses = {
  neutral: 'border border-line bg-page text-ink-muted',
  success: 'border border-forest-700/25 bg-forest-100 text-forest-800',
  warning: 'border border-warning-800/25 bg-warning-50 text-warning-800',
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

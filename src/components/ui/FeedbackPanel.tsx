import type { HTMLAttributes, PropsWithChildren } from 'react'

export type FeedbackTone = 'loading' | 'empty' | 'error' | 'info'

type FeedbackPanelProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    tone?: FeedbackTone
  }
>

const tonePresentation: Record<
  FeedbackTone,
  { label: string; panel: string; marker: string }
> = {
  empty: {
    label: 'No data',
    marker: 'border-line bg-page text-ink-muted',
    panel: 'border-line bg-panel text-ink-muted',
  },
  error: {
    label: 'Error',
    marker: 'border-danger-800/25 bg-danger-50 text-danger-800',
    panel: 'border-danger-800/25 bg-danger-50 text-danger-800',
  },
  info: {
    label: 'Notice',
    marker: 'border-forest-700/25 bg-forest-50 text-forest-800',
    panel: 'border-line bg-panel text-ink-muted',
  },
  loading: {
    label: 'Loading',
    marker: 'border-forest-700/25 bg-forest-50 text-forest-800',
    panel: 'border-line bg-panel text-ink-muted',
  },
}

export function FeedbackPanel({
  children,
  className = '',
  tone = 'info',
  ...props
}: FeedbackPanelProps) {
  const presentation = tonePresentation[tone]

  return (
    <div
      aria-busy={tone === 'loading' ? true : undefined}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${presentation.panel} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
      {...props}
    >
      <span
        className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${presentation.marker}`}
      >
        {presentation.label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

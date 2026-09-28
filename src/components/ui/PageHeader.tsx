import type { ReactNode } from 'react'

type PageHeaderProps = {
  children?: ReactNode
  description?: string
  eyebrow?: string
  title: string
  titleId?: string
}

export function PageHeader({
  children,
  description,
  eyebrow = 'Slimpossible',
  title,
  titleId = 'page-title',
}: PageHeaderProps) {
  return (
    <div aria-labelledby={titleId}>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest-700">
        {eyebrow}
      </p>
      <h1
        className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-6xl"
        id={titleId}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  )
}

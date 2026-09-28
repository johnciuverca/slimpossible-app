import type { HTMLAttributes, PropsWithChildren } from 'react'

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-panel border border-line/80 bg-panel shadow-panel ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

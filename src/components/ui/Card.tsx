import type { HTMLAttributes, PropsWithChildren } from 'react'

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl bg-white shadow-xl shadow-slate-200/60 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

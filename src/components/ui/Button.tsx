import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variantClasses = {
  ghost: 'text-ink-muted hover:bg-page hover:text-ink',
  primary: 'bg-forest-800 text-white hover:bg-forest-900',
  secondary: 'bg-forest-100 text-forest-800 hover:bg-forest-200',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-page disabled:text-ink-muted disabled:opacity-100 ${variantClasses[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

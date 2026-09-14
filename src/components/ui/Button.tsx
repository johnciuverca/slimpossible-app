import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variantClasses = {
  ghost: 'text-slate-600 hover:bg-stone-100 hover:text-slate-900',
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800',
  secondary: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

import type { InputHTMLAttributes } from 'react'

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  label: string
}

export function TextInput({
  className = '',
  error,
  id,
  label,
  ...props
}: TextInputProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <label className="text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`mt-2 block w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink outline-none transition placeholder:text-ink-muted focus:border-forest-700 focus:ring-2 focus:ring-forest-100 ${className}`}
        id={id}
        {...props}
      />
      {error ? (
        <p className="mt-2 text-sm font-medium text-danger-800" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

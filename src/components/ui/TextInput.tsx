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
      <label className="text-sm font-semibold text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 ${className}`}
        id={id}
        {...props}
      />
      {error ? (
        <p className="mt-2 text-sm text-red-700" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

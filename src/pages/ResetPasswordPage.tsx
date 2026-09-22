import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { Button, Card, PageHeader, TextInput } from '../components/ui'

type ResetErrors = {
  confirmPassword?: string
  password?: string
}

function validatePassword(
  password: string,
  confirmPassword: string,
): ResetErrors {
  const errors: ResetErrors = {}

  if (!password) {
    errors.password = 'Enter a new password.'
  } else if (password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your new password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match.'
  }

  return errors
}

export function ResetPasswordPage() {
  const { resetPassword, state } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<ResetErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validatePassword(password, confirmPassword)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    const didReset = await resetPassword(password)
    setIsSubmitting(false)

    if (didReset) {
      navigate('/login', { replace: true, state: { passwordReset: true } })
    }
  }

  const canReset = state.status === 'recovery-ready'
  const invalidRecovery =
    state.status === 'recovery-invalid' || state.status === 'signed-out'

  return (
    <section
      aria-labelledby="reset-password-title"
      className="mx-auto flex w-full max-w-md flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader
          description="Choose a new password after opening a valid recovery link."
          title="Choose a new password"
          titleId="reset-password-title"
        />

        {state.status === 'loading' ? (
          <p aria-live="polite" className="mt-8 text-sm text-slate-600">
            Checking your recovery link…
          </p>
        ) : null}
        {invalidRecovery ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-red-700"
            role="alert"
          >
            This password recovery link is invalid or expired. Request a new
            link.
          </p>
        ) : null}
        {state.status === 'error' ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-red-700"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        {canReset ? (
          <form
            aria-label="Reset password form"
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextInput
              autoComplete="new-password"
              error={errors.password}
              id="reset-password"
              label="New password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <TextInput
              autoComplete="new-password"
              error={errors.confirmPassword}
              id="reset-confirm-password"
              label="Confirm new password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Updating password…' : 'Update password'}
            </Button>
          </form>
        ) : null}

        <Link
          className="mt-6 inline-block text-sm text-emerald-700 underline"
          to="/forgot-password"
        >
          Request a new recovery link
        </Link>
      </Card>
    </section>
  )
}

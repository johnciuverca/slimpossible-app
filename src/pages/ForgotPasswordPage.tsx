import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { getAuthenticationEnvironmentLabel } from '../auth/supabaseConfig'
import { isValidEmail } from './authValidation'

export function ForgotPasswordPage() {
  const { requestPasswordRecovery, state } = useAuth()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setEmailError('Enter your email address.')
      return
    }
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.')
      return
    }

    setEmailError('')
    setIsSubmitting(true)
    await requestPasswordRecovery(email)
    setIsSubmitting(false)
  }

  return (
    <section
      aria-labelledby="forgot-password-title"
      className="mx-auto flex w-full max-w-md flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader
          description="Request a secure link to choose a new password."
          title="Reset your password"
          titleId="forgot-password-title"
        >
          <StatusPill>{getAuthenticationEnvironmentLabel()}</StatusPill>
        </PageHeader>

        <form
          aria-label="Password recovery form"
          className="mt-8 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <TextInput
            autoComplete="email"
            error={emailError}
            id="recovery-email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />

          {state.status === 'recovery-requested' ? (
            <p aria-live="polite" className="text-sm text-emerald-700">
              If an account matches that email, we sent a password recovery
              link. Check your inbox and spam folder.
            </p>
          ) : null}
          {state.status === 'error' ? (
            <p aria-live="polite" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending link…' : 'Send recovery link'}
          </Button>
        </form>

        <Link
          className="mt-6 inline-block text-sm text-emerald-700 underline"
          to="/login"
        >
          Back to sign in
        </Link>
      </Card>
    </section>
  )
}

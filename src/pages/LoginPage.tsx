import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'

type LoginErrors = {
  email?: string
  password?: string
}

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {}

  if (!email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!validEmail.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Enter your password.'
  }

  return errors
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      setSubmitError(
        'Remote authentication is not configured in this local preview yet.',
      )
    }, 300)
  }

  return (
    <section
      aria-labelledby="login-title"
      className="mx-auto flex w-full max-w-md flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader
          description="Sign in to continue your sustainable progress."
          title="Welcome back."
          titleId="login-title"
        >
          <StatusPill>Local preview</StatusPill>
        </PageHeader>

        <form
          aria-label="Login form"
          className="mt-8 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <TextInput
            autoComplete="email"
            error={errors.email}
            id="login-email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <TextInput
            autoComplete="current-password"
            error={errors.password}
            id="login-password"
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />

          {submitError ? (
            <p aria-live="polite" className="text-sm text-red-700" role="alert">
              {submitError}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-6 text-slate-600">
          Registration and remote authentication will be connected in the
          following auth issues.
        </p>
        <Link
          className="mt-4 inline-block text-sm text-emerald-700 underline"
          to="/"
        >
          Back to home
        </Link>
      </Card>
    </section>
  )
}

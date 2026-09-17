import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { useAuth } from '../auth/useAuth'

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
  const { signIn, state } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (state.status !== 'signed-in') return

    const from = (
      location.state as {
        from?: { pathname?: string; search?: string; hash?: string }
      } | null
    )?.from
    const destination = from
      ? `${from.pathname ?? '/'}${from.search ?? ''}${from.hash ?? ''}`
      : '/'
    navigate(destination, { replace: true })
  }, [location.state, navigate, state.status])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    await signIn(email, password)
    setIsSubmitting(false)
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

          {state.status === 'error' || submitError ? (
            <p aria-live="polite" className="text-sm text-red-700">
              {state.status === 'error' ? state.error : submitError}
            </p>
          ) : null}
          {state.status === 'signed-in' ? (
            <p aria-live="polite" className="text-sm text-emerald-700">
              Signed in successfully.
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-6 text-slate-600">
          Need an account?{' '}
          <Link className="text-emerald-700 underline" to="/register">
            Create one
          </Link>
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

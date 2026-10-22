import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { safeInternalPath } from '../auth/authRedirects'
import { PROFILE_NAME_MAX_LENGTH } from '../auth/profileName'
import { useAuth } from '../auth/useAuth'
import { getAuthenticationEnvironmentLabel } from '../auth/supabaseConfig'
import { isValidEmail } from './authValidation'

type RegisterErrors = {
  confirmPassword?: string
  email?: string
  name?: string
  password?: string
}

function validateRegistration(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
): RegisterErrors {
  const errors: RegisterErrors = {}

  if (!name.trim()) {
    errors.name = 'Enter your name.'
  } else if (name.trim().length > PROFILE_NAME_MAX_LENGTH) {
    errors.name = `Use ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`
  }

  if (!email.trim()) {
    errors.email = 'Enter your email address.'
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Create a password.'
  } else if (password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match.'
  }

  return errors
}

export function RegisterPage() {
  const { signUp, state } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (state.status === 'signed-in' && location.state) {
      navigate(safeInternalPath(location.state), { replace: true })
    }
  }, [location.state, navigate, state.status])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateRegistration(
      name,
      email,
      password,
      confirmPassword,
    )
    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    await signUp(name, email, password)
    setIsSubmitting(false)
  }

  return (
    <section
      aria-labelledby="register-title"
      className="auth-page mx-auto flex w-full max-w-md flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader
          description="Create your account to join the challenge."
          title="Create your account."
          titleId="register-title"
        >
          <StatusPill>{getAuthenticationEnvironmentLabel()}</StatusPill>
        </PageHeader>

        <form
          aria-label="Registration form"
          className="mt-8 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <TextInput
            autoComplete="name"
            error={errors.name}
            id="register-name"
            label="Full name"
            maxLength={PROFILE_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
          <TextInput
            autoComplete="email"
            error={errors.email}
            id="register-email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <TextInput
            autoComplete="new-password"
            error={errors.password}
            id="register-password"
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <TextInput
            autoComplete="new-password"
            error={errors.confirmPassword}
            id="register-confirm-password"
            label="Confirm password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            value={confirmPassword}
          />

          {state.status === 'error' ||
          state.status === 'verification-pending' ||
          state.status === 'signed-in' ||
          submitError ? (
            <p
              aria-live="polite"
              className={
                state.status === 'error' || submitError
                  ? 'text-sm text-danger-800'
                  : 'text-sm text-forest-700'
              }
            >
              {state.status === 'error'
                ? state.error
                : state.status === 'verification-pending'
                  ? 'Account created. Check your email to verify your account before signing in.'
                  : state.status === 'signed-in'
                    ? 'Account created and signed in successfully.'
                    : submitError}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-sm leading-6 text-ink-muted">
          Already have an account?{' '}
          <Link
            className="text-forest-700 underline"
            state={location.state}
            to="/login"
          >
            Sign in
          </Link>
        </p>
        <nav
          aria-label="Authentication links"
          className="mt-6 flex flex-col items-start gap-4"
        >
          <Link
            className="inline-block text-sm text-forest-700 underline"
            to="/forgot-password"
          >
            Forgot your password?
          </Link>
          <Link
            className="inline-block text-sm text-forest-700 underline"
            to="/"
          >
            Back to home
          </Link>
        </nav>
        {state.status === 'verification-pending' ? (
          <Link
            className="mt-4 inline-block text-sm text-forest-700 underline"
            state={location.state}
            to="/login"
          >
            Return to sign in after verification
          </Link>
        ) : null}
      </Card>
    </section>
  )
}

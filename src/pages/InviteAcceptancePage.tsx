import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useOptionalAuth } from '../auth/useAuth'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { createInvitePersistence } from '../data/persistence'
import {
  validateInviteAcceptance,
  type ChallengeInvitePreview,
  type InviteValidationField,
} from '../models/challengeInvite'

type InviteFormValues = {
  displayName: string
  startingWeightKg: string
  targetWeightKg: string
}

type InviteFormErrors = Partial<Record<InviteValidationField, string>>

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function returnLocation(location: ReturnType<typeof useLocation>) {
  return {
    from: {
      hash: location.hash,
      pathname: location.pathname,
      search: location.search,
    },
  }
}

function mapValidationErrors(
  issues: { field: InviteValidationField; message: string }[],
) {
  const errors: InviteFormErrors = {}
  issues.forEach(({ field, message }) => {
    errors[field] = message
  })
  return errors
}

export function InviteAcceptancePage() {
  const { state: authState } = useOptionalAuth()
  const location = useLocation()
  const { token = '' } = useParams()
  const persistence = useMemo(
    () => createInvitePersistence(authState),
    [authState],
  )
  const [preview, setPreview] = useState<ChallengeInvitePreview | null>(null)
  const [values, setValues] = useState<InviteFormValues>({
    displayName: '',
    startingWeightKg: '',
    targetWeightKg: '',
  })
  const [errors, setErrors] = useState<InviteFormErrors>({})
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    let isCurrent = true

    async function loadPreview() {
      if (persistence.mode === 'unavailable') {
        setMessage(persistence.message)
        setIsLoading(false)
        return
      }

      const result = await persistence.repositories.invites.preview(token)
      if (!isCurrent) return
      if (result.state === 'error') {
        setMessage(result.error.message)
      } else if (result.state === 'empty') {
        setMessage('This invitation is invalid or no longer available.')
      } else {
        setPreview(result.data)
      }
      setIsLoading(false)
    }

    void loadPreview()
    return () => {
      isCurrent = false
    }
  }, [persistence, token])

  function updateValue(field: keyof InviteFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !preview ||
      authState.status !== 'signed-in' ||
      persistence.mode === 'unavailable'
    ) {
      return
    }

    const result = validateInviteAcceptance({
      displayName: values.displayName,
      startingWeightKg: Number(values.startingWeightKg),
      targetWeightKg: Number(values.targetWeightKg),
    })
    if (!result.success) {
      setErrors(mapValidationErrors(result.issues))
      setMessage('Please correct the highlighted fields before joining.')
      return
    }

    setErrors({})
    setMessage('')
    setIsSubmitting(true)
    const acceptedResult = await persistence.repositories.invites.accept(
      token,
      result.data,
      authState.user.id,
    )
    setIsSubmitting(false)

    if (acceptedResult.state === 'error') {
      setMessage(acceptedResult.error.message)
      return
    }
    if (acceptedResult.state === 'empty') {
      setMessage('The invitation could not be accepted.')
      return
    }

    setAccepted(true)
    setMessage(
      'Your membership is ready. Repeating this action will not create a duplicate membership.',
    )
  }

  const destination = preview
    ? `/today?challenge=${encodeURIComponent(preview.challengeId)}`
    : '/'

  return (
    <section aria-labelledby="invite-acceptance-title" className="w-full">
      <Card className="mx-auto max-w-2xl p-8 sm:p-12">
        <PageHeader
          description="Review the invitation, sign in, and join with the authenticated profile on your account."
          title="Join a challenge."
          titleId="invite-acceptance-title"
        >
          <StatusPill>Invitation</StatusPill>
        </PageHeader>

        {isLoading ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-slate-600"
            role="status"
          >
            Checking invitation…
          </p>
        ) : message && !preview ? (
          <p
            aria-live="polite"
            className="mt-8 text-sm text-red-700"
            role="alert"
          >
            {message}
          </p>
        ) : preview ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <h2 className="text-xl font-bold text-slate-950">
                {preview.challengeName}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This link expires on {formatDate(preview.expiresAt)}.
              </p>
              {preview.status !== 'active' ? (
                <p
                  className="mt-4 text-sm font-semibold text-red-700"
                  role="alert"
                >
                  This invitation is {preview.status}.
                </p>
              ) : null}
            </div>

            {preview.status === 'active' &&
            !accepted &&
            authState.status !== 'signed-in' ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  Sign in or create an account first. After authentication, you
                  will return here to accept this invitation.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                    state={returnLocation(location)}
                    to="/login"
                  >
                    Sign in to accept
                  </Link>
                  <Link
                    className="rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold text-emerald-700"
                    state={returnLocation(location)}
                    to="/register"
                  >
                    Create an account
                  </Link>
                </div>
              </div>
            ) : null}

            {preview.status === 'active' &&
            !accepted &&
            authState.status === 'signed-in' ? (
              <form
                aria-label="Accept invitation form"
                className="space-y-5"
                noValidate
                onSubmit={handleSubmit}
              >
                <TextInput
                  error={errors.displayName}
                  id="invite-display-name"
                  label="Display name"
                  onChange={(event) =>
                    updateValue('displayName', event.target.value)
                  }
                  type="text"
                  value={values.displayName}
                />
                <TextInput
                  error={errors.startingWeightKg}
                  id="invite-starting-weight"
                  inputMode="decimal"
                  label="Starting weight in kg"
                  min="0"
                  onChange={(event) =>
                    updateValue('startingWeightKg', event.target.value)
                  }
                  step="0.1"
                  type="number"
                  value={values.startingWeightKg}
                />
                <TextInput
                  error={errors.targetWeightKg}
                  id="invite-target-weight"
                  inputMode="decimal"
                  label="Target weight in kg"
                  min="0"
                  onChange={(event) =>
                    updateValue('targetWeightKg', event.target.value)
                  }
                  step="0.1"
                  type="number"
                  value={values.targetWeightKg}
                />
                {message ? (
                  <p
                    aria-live="polite"
                    className="text-sm text-red-700"
                    role="alert"
                  >
                    {message}
                  </p>
                ) : null}
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Joining…' : 'Join challenge'}
                </Button>
              </form>
            ) : null}

            {accepted ? (
              <div className="space-y-4">
                <p
                  aria-live="polite"
                  className="text-sm text-emerald-800"
                  role="status"
                >
                  {message}
                </p>
                <Link
                  className="text-sm text-emerald-700 underline"
                  to={destination}
                >
                  Open your challenge dashboard
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  )
}

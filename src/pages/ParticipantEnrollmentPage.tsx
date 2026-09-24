import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import type {
  Participant,
  ParticipantValidationField,
} from '../models/participant'
import { validateParticipant } from '../models/participant'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'

type EnrollmentValues = {
  displayName: string
  startingWeightKg: string
  targetWeightKg: string
  userId: string
}

type EnrollmentField = keyof EnrollmentValues
type EnrollmentErrors = Partial<Record<EnrollmentField, string>>

const initialValues: EnrollmentValues = {
  displayName: '',
  startingWeightKg: '',
  targetWeightKg: '',
  userId: '',
}

const localChallengeId = 'challenge-preview'

function mapValidationErrors(
  issues: { field: ParticipantValidationField; message: string }[],
): EnrollmentErrors {
  const errors: EnrollmentErrors = {}

  issues.forEach(({ field, message }) => {
    if (field in initialValues) {
      errors[field as EnrollmentField] = message
    }
  })

  return errors
}

export function ParticipantEnrollmentPage() {
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [values, setValues] = useState(initialValues)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [errors, setErrors] = useState<EnrollmentErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [challengeId, setChallengeId] = useState(localChallengeId)

  useEffect(() => {
    let isCurrent = true

    async function loadParticipants() {
      if (
        authState.status === 'loading' &&
        persistence.mode === 'unavailable'
      ) {
        setSubmitError('')
        setIsLoading(true)
        return
      }

      setIsLoading(true)
      setSubmitError('')

      if (persistence.mode === 'unavailable') {
        if (isCurrent) {
          setSubmitError(
            authState.status === 'error'
              ? authState.error
              : persistence.message,
          )
          setIsLoading(false)
        }
        return
      }

      const challenges = await persistence.repositories.challenges.listOwned()
      if (!isCurrent) {
        return
      }

      if (challenges.state === 'error') {
        setSubmitError(challenges.error.message)
        setIsLoading(false)
        return
      }

      const savedChallengeId =
        challenges.state === 'success' ? challenges.data[0]?.id : undefined
      if (persistence.mode === 'remote' && !savedChallengeId) {
        setSubmitError('Create a challenge before enrolling participants.')
        setIsLoading(false)
        return
      }

      const nextChallengeId = savedChallengeId ?? localChallengeId
      setChallengeId(nextChallengeId)
      const result =
        await persistence.repositories.participants.listForChallenge(
          nextChallengeId,
        )
      if (!isCurrent) {
        return
      }

      if (result.state === 'error') {
        setSubmitError(result.error.message)
      } else if (result.state === 'success') {
        setParticipants(result.data)
      }
      setIsLoading(false)
    }

    void loadParticipants()
    return () => {
      isCurrent = false
    }
  }, [authState, persistence])

  function updateValue(field: EnrollmentField, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (authState.status === 'loading' && persistence.mode === 'unavailable') {
      return
    }

    const authenticatedUserId =
      persistence.mode === 'remote' && authState.status === 'signed-in'
        ? authState.user.id
        : undefined

    const candidate: Participant = {
      challengeId,
      displayName: values.displayName.trim(),
      id: `participant-${participants.length + 1}`,
      joinedAt: new Date().toISOString(),
      status: 'active',
      startingWeightKg: Number(values.startingWeightKg),
      targetWeightKg: Number(values.targetWeightKg),
      userId: authenticatedUserId ?? values.userId.trim(),
    }
    const result = validateParticipant(candidate)

    setSuccessMessage('')

    if (!result.success) {
      setErrors(mapValidationErrors(result.issues))
      setSubmitError('Please correct the highlighted fields before enrolling.')
      return
    }

    setErrors({})
    setSubmitError('')
    if (persistence.mode === 'unavailable') {
      setSubmitError(persistence.message)
      return
    }

    setIsSaving(true)
    const saved = await persistence.repositories.participants.create({
      challengeId: result.data.challengeId,
      displayName: result.data.displayName,
      joinedAt: result.data.joinedAt,
      startingWeightKg: result.data.startingWeightKg,
      status: result.data.status,
      targetWeightKg: result.data.targetWeightKg,
      userId: result.data.userId,
    })
    setIsSaving(false)

    if (saved.state === 'error') {
      setSubmitError(saved.error.message)
      return
    }
    if (saved.state === 'empty') {
      setSubmitError('The participant could not be saved.')
      return
    }

    setParticipants((currentParticipants) => [
      ...currentParticipants,
      saved.data,
    ])
    setValues(initialValues)
    setSuccessMessage(
      persistence.mode === 'remote'
        ? `${saved.data.displayName} was enrolled remotely.`
        : `${saved.data.displayName} was enrolled in the local challenge.`,
    )
  }

  return (
    <section
      aria-labelledby="participant-enrollment-title"
      className="mx-auto flex w-full max-w-4xl flex-1 items-center"
    >
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card className="p-8 sm:p-10">
          <PageHeader
            description="Add a participant and set a loss, maintenance, or gain goal for this challenge."
            title="Enroll a participant."
            titleId="participant-enrollment-title"
          >
            <StatusPill>
              {persistence.mode === 'remote'
                ? 'Remote enrollment'
                : persistence.mode === 'unavailable'
                  ? 'Remote unavailable'
                  : 'Local enrollment'}
            </StatusPill>
          </PageHeader>

          <form
            aria-label="Participant enrollment form"
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextInput
              autoComplete="off"
              error={errors.displayName}
              id="participant-display-name"
              label="Display name"
              onChange={(event) =>
                updateValue('displayName', event.target.value)
              }
              type="text"
              value={values.displayName}
            />
            {persistence.mode === 'remote' &&
            authState.status === 'signed-in' ? (
              <p className="text-sm leading-6 text-slate-600">
                This membership will be linked to your signed-in account.
              </p>
            ) : (
              <TextInput
                autoComplete="off"
                error={errors.userId}
                id="participant-user-id"
                label="Participant identifier"
                onChange={(event) => updateValue('userId', event.target.value)}
                type="text"
                value={values.userId}
              />
            )}
            <TextInput
              error={errors.startingWeightKg}
              id="participant-starting-weight"
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
              id="participant-target-weight"
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

            {submitError ? (
              <p
                aria-live="polite"
                className="text-sm text-red-700"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}
            {successMessage ? (
              <p
                aria-live="polite"
                className="text-sm text-emerald-800"
                role="status"
              >
                {successMessage}
              </p>
            ) : null}

            <Button
              className="w-full"
              disabled={
                isSaving ||
                persistence.mode === 'unavailable' ||
                (isLoading && persistence.mode === 'remote')
              }
              type="submit"
            >
              {isSaving ? 'Saving participant…' : 'Enroll participant'}
            </Button>
          </form>

          <Link
            className="mt-6 inline-block text-sm text-emerald-700 underline"
            to="/challenge/setup"
          >
            Back to challenge setup
          </Link>
        </Card>

        <Card
          aria-labelledby="enrolled-participants-title"
          className="p-8 sm:p-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {persistence.mode === 'remote'
              ? 'Remote memberships'
              : 'Local preview'}
          </p>
          <h2
            className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
            id="enrolled-participants-title"
          >
            Enrolled participants
          </h2>
          {isLoading ? (
            <p
              aria-live="polite"
              className="mt-5 text-sm text-slate-600"
              role="status"
            >
              {authState.status === 'loading' &&
              persistence.mode === 'unavailable'
                ? 'Restoring your session…'
                : 'Loading saved participants…'}
            </p>
          ) : null}
          {!isLoading && participants.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              No participants enrolled yet.
            </p>
          ) : !isLoading ? (
            <ul className="mt-5 space-y-3" aria-label="Enrolled participants">
              {participants.map((participant) => (
                <li
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                  key={participant.id}
                >
                  <p className="font-semibold text-slate-900">
                    {participant.displayName}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {participant.startingWeightKg} kg →{' '}
                    {participant.targetWeightKg} kg
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {participant.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-6 text-xs leading-5 text-slate-500">
            {persistence.mode === 'remote'
              ? 'Memberships are loaded from the owner-authorized repository.'
              : 'This local preview is stored in this browser and is available after refresh.'}
          </p>
        </Card>
      </div>
    </section>
  )
}

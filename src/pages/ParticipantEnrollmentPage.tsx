import { useState, type FormEvent } from 'react'
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
  const [values, setValues] = useState(initialValues)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [errors, setErrors] = useState<EnrollmentErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  function updateValue(field: EnrollmentField, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setSubmitError('')
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const candidate: Participant = {
      challengeId: localChallengeId,
      displayName: values.displayName.trim(),
      id: `participant-${participants.length + 1}`,
      joinedAt: new Date().toISOString(),
      status: 'active',
      startingWeightKg: Number(values.startingWeightKg),
      targetWeightKg: Number(values.targetWeightKg),
      userId: values.userId.trim(),
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
    setParticipants((currentParticipants) => [
      ...currentParticipants,
      result.data,
    ])
    setValues(initialValues)
    setSuccessMessage(
      `${result.data.displayName} was enrolled in the local challenge.`,
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
            description="Add a participant and set their starting point and goal for this challenge."
            title="Enroll a participant."
            titleId="participant-enrollment-title"
          >
            <StatusPill>Local enrollment</StatusPill>
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
            <TextInput
              autoComplete="off"
              error={errors.userId}
              id="participant-user-id"
              label="Participant identifier"
              onChange={(event) => updateValue('userId', event.target.value)}
              type="text"
              value={values.userId}
            />
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

            <Button className="w-full" type="submit">
              Enroll participant
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
            Local preview
          </p>
          <h2
            className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
            id="enrolled-participants-title"
          >
            Enrolled participants
          </h2>
          {participants.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              No participants enrolled yet.
            </p>
          ) : (
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
          )}
          <p className="mt-6 text-xs leading-5 text-slate-500">
            This preview is held in memory only and is cleared when the page is
            refreshed.
          </p>
        </Card>
      </div>
    </section>
  )
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { participantFixture } from '../models/fixtures'
import type { Participant } from '../models/participant'
import { sortWeighInsByDate, upsertWeighIn } from '../models/weighInStore'
import type { WeighInValidationField } from '../models/weighIn'
import type { WeighIn } from '../models/weighIn'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'

type WeighInFormValues = {
  date: string
  note: string
  weightKg: string
}

type WeighInFormField = keyof WeighInFormValues
type WeighInFormErrors = Partial<Record<WeighInFormField, string>>

function todayAsDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

const initialValues: WeighInFormValues = {
  date: todayAsDateOnly(),
  note: '',
  weightKg: '',
}

function mapValidationErrors(
  issues: { field: WeighInValidationField; message: string }[],
): WeighInFormErrors {
  const errors: WeighInFormErrors = {}

  issues.forEach(({ field, message }) => {
    if (field in initialValues) {
      errors[field as WeighInFormField] = message
    }
  })

  return errors
}

export function DailyWeighInFormPage() {
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const authenticatedUserId =
    authState.status === 'signed-in' && authState.user.id
      ? authState.user.id
      : ''
  const [values, setValues] = useState(initialValues)
  const [memberships, setMemberships] = useState<Participant[]>([
    participantFixture,
  ])
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    participantFixture.id,
  )
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [errors, setErrors] = useState<WeighInFormErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadWeighIns() {
      setIsLoading(true)
      setWeighIns([])

      if (persistence.mode === 'unavailable') {
        if (isCurrent) {
          setSubmitError(persistence.message)
          setIsLoading(false)
        }
        return
      }

      let participantId = participantFixture.id
      if (persistence.mode === 'remote') {
        if (!authenticatedUserId) {
          setSubmitError(
            'Sign in before loading your challenge membership and weigh-ins.',
          )
          setMemberships([])
          setSelectedParticipantId('')
          setIsLoading(false)
          return
        }

        const membershipsResult =
          await persistence.repositories.participants.listForUser(
            authenticatedUserId,
          )
        if (!isCurrent) {
          return
        }

        if (membershipsResult.state === 'error') {
          setSubmitError(membershipsResult.error.message)
          setMemberships([])
          setSelectedParticipantId('')
          setIsLoading(false)
          return
        }
        if (membershipsResult.state === 'empty') {
          setSubmitError(
            'You are not enrolled in a challenge yet. Ask the challenge owner to add your account.',
          )
          setMemberships([])
          setSelectedParticipantId('')
          setIsLoading(false)
          return
        }

        setMemberships(membershipsResult.data)
        participantId = membershipsResult.data[0].id
        setSelectedParticipantId(participantId)
      } else {
        setMemberships([participantFixture])
        setSelectedParticipantId(participantId)
      }

      const result =
        await persistence.repositories.weighIns.listForParticipant(
          participantId,
        )
      if (!isCurrent) {
        return
      }

      if (result.state === 'error') {
        setSubmitError(result.error.message)
      } else if (result.state === 'success') {
        setWeighIns(result.data)
      }
      setIsLoading(false)
    }

    void loadWeighIns()
    return () => {
      isCurrent = false
    }
  }, [authenticatedUserId, persistence])

  async function selectMembership(participantId: string) {
    if (persistence.mode === 'unavailable') {
      setSubmitError(persistence.message)
      return
    }
    if (!memberships.some((membership) => membership.id === participantId)) {
      setSubmitError(
        'That challenge membership is not available to the signed-in account.',
      )
      return
    }

    setSelectedParticipantId(participantId)
    setWeighIns([])
    setSubmitError('')
    setSuccessMessage('')
    setIsLoading(true)
    const result =
      await persistence.repositories.weighIns.listForParticipant(participantId)
    if (result.state === 'error') {
      setSubmitError(result.error.message)
    } else if (result.state === 'success') {
      setWeighIns(result.data)
    }
    setIsLoading(false)
  }

  function updateValue(field: WeighInFormField, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setSubmitError('')
    setSuccessMessage('')
  }

  function startEditing(weighIn: WeighIn) {
    setEditingDate(weighIn.date)
    setValues({
      date: weighIn.date,
      note: weighIn.note ?? '',
      weightKg: String(weighIn.weightKg),
    })
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  function cancelEditing() {
    setEditingDate(null)
    setValues(initialValues)
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedParticipantId) {
      setSubmitError(
        'Select an available challenge membership before saving a weigh-in.',
      )
      setSuccessMessage('')
      return
    }

    const input = {
      date: values.date,
      note: values.note.trim() || undefined,
      participantId: selectedParticipantId,
      weightKg: Number(values.weightKg),
    }
    const result = upsertWeighIn(weighIns, input)

    if (!result.success) {
      setErrors(mapValidationErrors(result.issues))
      setSubmitError('Please correct the highlighted fields before saving.')
      setSuccessMessage('')
      return
    }

    if (persistence.mode === 'unavailable') {
      setSubmitError(persistence.message)
      setSuccessMessage('')
      return
    }

    setIsSaving(true)
    const saved = await persistence.repositories.weighIns.upsert(input)
    setIsSaving(false)

    if (saved.state === 'error') {
      setSubmitError(saved.error.message)
      setSuccessMessage('')
      return
    }
    if (saved.state === 'empty') {
      setSubmitError('The weigh-in could not be saved.')
      setSuccessMessage('')
      return
    }

    const nextState = upsertWeighIn(weighIns, saved.data, {
      today: values.date,
    })
    if (!nextState.success) {
      setSubmitError('The saved weigh-in could not be displayed.')
      setSuccessMessage('')
      return
    }

    setWeighIns(nextState.data)
    setErrors({})
    setSubmitError('')
    setEditingDate(null)
    setValues(initialValues)
    setSuccessMessage(
      persistence.mode === 'remote'
        ? 'Weigh-in saved remotely.'
        : result.operation === 'created'
          ? 'Weigh-in created in local storage.'
          : 'Weigh-in updated in local storage.',
    )
  }

  return (
    <section
      aria-labelledby="daily-weigh-in-title"
      className="mx-auto flex w-full max-w-4xl flex-1 items-center"
    >
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card className="p-8 sm:p-10">
          <PageHeader
            description={
              persistence.mode === 'remote'
                ? 'Record your weight for the selected challenge membership.'
                : 'Record today’s weight for the local preview participant.'
            }
            title="Daily weigh-in."
            titleId="daily-weigh-in-title"
          >
            <StatusPill>
              {persistence.mode === 'remote'
                ? 'Remote data'
                : persistence.mode === 'unavailable'
                  ? 'Remote unavailable'
                  : 'Local storage'}
            </StatusPill>
          </PageHeader>

          {selectedParticipantId ? (
            <p className="mt-6 text-sm text-slate-600">
              Participant:{' '}
              <strong>
                {memberships.find(
                  (membership) => membership.id === selectedParticipantId,
                )?.displayName ?? participantFixture.displayName}
              </strong>
            </p>
          ) : null}

          <form
            aria-label="Daily weigh-in form"
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit}
          >
            {persistence.mode === 'remote' && memberships.length > 0 ? (
              <div>
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="weigh-in-challenge"
                >
                  Challenge membership
                </label>
                <select
                  className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  id="weigh-in-challenge"
                  onChange={(event) =>
                    void selectMembership(event.target.value)
                  }
                  value={selectedParticipantId}
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      Challenge {membership.challengeId}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <TextInput
              error={errors.date}
              id="daily-weigh-in-date"
              label="Date"
              max={todayAsDateOnly()}
              onChange={(event) => updateValue('date', event.target.value)}
              readOnly={editingDate !== null}
              type="date"
              value={values.date}
            />
            <TextInput
              error={errors.weightKg}
              id="daily-weigh-in-weight"
              inputMode="decimal"
              label="Weight in kg"
              min="0"
              onChange={(event) => updateValue('weightKg', event.target.value)}
              step="0.1"
              type="number"
              value={values.weightKg}
            />

            <div>
              <label
                className="text-sm font-semibold text-slate-700"
                htmlFor="daily-weigh-in-note"
              >
                Note{' '}
                <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                aria-describedby={
                  errors.note ? 'daily-weigh-in-note-error' : undefined
                }
                aria-invalid={errors.note ? true : undefined}
                className="mt-2 block min-h-24 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id="daily-weigh-in-note"
                onChange={(event) => updateValue('note', event.target.value)}
                value={values.note}
              />
              {errors.note ? (
                <p
                  className="mt-2 text-sm text-red-700"
                  id="daily-weigh-in-note-error"
                >
                  {errors.note}
                </p>
              ) : null}
            </div>

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

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  isSaving ||
                  (persistence.mode === 'remote' &&
                    (isLoading || !selectedParticipantId))
                }
                type="submit"
              >
                {editingDate ? 'Update weigh-in' : 'Save weigh-in'}
              </Button>
              {editingDate ? (
                <Button
                  onClick={cancelEditing}
                  type="button"
                  variant="secondary"
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>

          <Link
            className="mt-6 inline-block text-sm text-emerald-700 underline"
            to="/today"
          >
            Back to today
          </Link>
        </Card>

        <Card aria-labelledby="local-weigh-ins-title" className="p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {persistence.mode === 'remote'
              ? 'Your challenge weigh-ins'
              : 'Local preview'}
          </p>
          <h2
            className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
            id="local-weigh-ins-title"
          >
            Saved weigh-ins
          </h2>
          {isLoading ? (
            <p
              aria-live="polite"
              className="mt-5 text-sm text-slate-600"
              role="status"
            >
              Loading saved weigh-ins…
            </p>
          ) : persistence.mode === 'remote' && memberships.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              {submitError ||
                'No challenge memberships are available for this account.'}
            </p>
          ) : weighIns.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              No weigh-ins saved yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-3" aria-label="Saved weigh-ins">
              {sortWeighInsByDate(weighIns).map((weighIn) => (
                <li
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                  key={`${weighIn.participantId}-${weighIn.date}`}
                >
                  <p className="font-semibold text-slate-900">
                    {weighIn.date}: {weighIn.weightKg} kg
                  </p>
                  {weighIn.note ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {weighIn.note}
                    </p>
                  ) : null}
                  <Button
                    className="mt-3"
                    onClick={() => startEditing(weighIn)}
                    type="button"
                    variant="secondary"
                  >
                    Edit {weighIn.date}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm leading-6 text-slate-600">
            Missing calendar days stay absent; no record or change is created
            for them.
          </p>
          <p className="mt-6 text-xs leading-5 text-slate-500">
            {persistence.mode === 'remote'
              ? 'Weigh-ins are loaded from the owner-authorized repository.'
              : 'This local preview is stored in this browser and is available after refresh.'}
          </p>
        </Card>
      </div>
    </section>
  )
}

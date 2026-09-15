import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { participantFixture } from '../models/fixtures'
import { upsertWeighIn } from '../models/weighInStore'
import type { WeighInValidationField } from '../models/weighIn'
import type { WeighIn } from '../models/weighIn'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'

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
  const [values, setValues] = useState(initialValues)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [errors, setErrors] = useState<WeighInFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  function updateValue(field: WeighInFormField, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setSubmitError('')
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = upsertWeighIn(weighIns, {
      date: values.date,
      note: values.note.trim() || undefined,
      participantId: participantFixture.id,
      weightKg: Number(values.weightKg),
    })

    if (!result.success) {
      setErrors(mapValidationErrors(result.issues))
      setSubmitError('Please correct the highlighted fields before saving.')
      setSuccessMessage('')
      return
    }

    setWeighIns(result.data)
    setErrors({})
    setSubmitError('')
    setSuccessMessage(
      result.operation === 'created'
        ? 'Weigh-in created in local state.'
        : 'Weigh-in updated in local state.',
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
            description="Record today’s weight for the local preview participant."
            title="Daily weigh-in."
            titleId="daily-weigh-in-title"
          >
            <StatusPill>Local state</StatusPill>
          </PageHeader>

          <p className="mt-6 text-sm text-slate-600">
            Participant: <strong>{participantFixture.displayName}</strong>
          </p>

          <form
            aria-label="Daily weigh-in form"
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextInput
              error={errors.date}
              id="daily-weigh-in-date"
              label="Date"
              max={todayAsDateOnly()}
              onChange={(event) => updateValue('date', event.target.value)}
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

            <Button type="submit">Save weigh-in</Button>
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
            Local preview
          </p>
          <h2
            className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
            id="local-weigh-ins-title"
          >
            Saved weigh-ins
          </h2>
          {weighIns.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              No weigh-ins saved yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-3" aria-label="Saved weigh-ins">
              {weighIns.map((weighIn) => (
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
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs leading-5 text-slate-500">
            This local state is cleared when the page is refreshed.
          </p>
        </Card>
      </div>
    </section>
  )
}

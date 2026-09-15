import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { participantFixture } from '../models/fixtures'
import {
  findWeighInForDate,
  getWeightChangeForDate,
  validateWeighIn,
  type WeighIn,
  type WeighInValidationField,
} from '../models/weighIn'
import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'

type WeighInValues = {
  date: string
  note: string
  participantId: string
  weightKg: string
}

type WeighInField = keyof WeighInValues
type WeighInErrors = Partial<Record<WeighInField, string>>

function todayAsDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

function initialValues(): WeighInValues {
  return {
    date: todayAsDateOnly(),
    note: '',
    participantId: participantFixture.id,
    weightKg: '',
  }
}

function mapValidationErrors(
  issues: { field: WeighInValidationField; message: string }[],
): WeighInErrors {
  const errors: WeighInErrors = {}

  issues.forEach(({ field, message }) => {
    if (field in initialValues()) {
      errors[field as WeighInField] = message
    }
  })

  return errors
}

function formatWeightChange(change: number) {
  if (change === 0) {
    return 'No change from the previous weigh-in.'
  }

  return `${change > 0 ? '+' : ''}${change.toFixed(1)} kg from the previous weigh-in.`
}

export function WeighInPage() {
  const [values, setValues] = useState(initialValues)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [errors, setErrors] = useState<WeighInErrors>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const selectedWeighIn = findWeighInForDate(
    weighIns,
    values.participantId,
    values.date,
  )
  const selectedChange = getWeightChangeForDate(
    weighIns,
    values.participantId,
    values.date,
  )
  const participantWeighIns = weighIns.filter(
    (weighIn) => weighIn.participantId === values.participantId,
  )

  function updateValue(field: WeighInField, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setSubmitError('')
    setSuccessMessage('')
  }

  function resetForm() {
    setValues(initialValues())
    setErrors({})
    setEditingId(null)
    setSubmitError('')
    setSuccessMessage('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const candidate: WeighIn = {
      date: values.date,
      id: editingId ?? `weigh-in-${weighIns.length + 1}`,
      note: values.note.trim() || undefined,
      participantId: values.participantId.trim(),
      weightKg: Number(values.weightKg),
    }
    const result = validateWeighIn(candidate)

    setSuccessMessage('')

    if (!result.success) {
      setErrors(mapValidationErrors(result.issues))
      setSubmitError('Please correct the highlighted fields before saving.')
      return
    }

    if (
      findWeighInForDate(
        weighIns,
        result.data.participantId,
        result.data.date,
        editingId ?? undefined,
      )
    ) {
      setErrors({
        date: 'A weigh-in already exists for this participant on this date.',
      })
      setSubmitError('Choose another date or edit the existing weigh-in.')
      return
    }

    if (editingId) {
      setWeighIns((currentWeighIns) =>
        currentWeighIns.map((weighIn) =>
          weighIn.id === editingId ? result.data : weighIn,
        ),
      )
      setSuccessMessage('Weigh-in updated in the local preview.')
    } else {
      setWeighIns((currentWeighIns) => [...currentWeighIns, result.data])
      setSuccessMessage('Weigh-in saved in the local preview.')
    }

    setValues((currentValues) => ({
      ...initialValues(),
      participantId: currentValues.participantId,
    }))
    setErrors({})
    setEditingId(null)
    setSubmitError('')
  }

  function startEditing(weighIn: WeighIn) {
    setEditingId(weighIn.id)
    setValues({
      date: weighIn.date,
      note: weighIn.note ?? '',
      participantId: weighIn.participantId,
      weightKg: String(weighIn.weightKg),
    })
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  return (
    <section
      aria-labelledby="weigh-in-title"
      className="mx-auto flex w-full max-w-4xl flex-1 items-center"
    >
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card className="p-8 sm:p-10">
          <PageHeader
            description="Record one weight per participant each day. Missing days stay missing and do not create false changes."
            title="Daily weigh-in."
            titleId="weigh-in-title"
          >
            <StatusPill>Local preview</StatusPill>
          </PageHeader>

          <form
            aria-label="Daily weigh-in form"
            className="mt-8 space-y-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextInput
              autoComplete="off"
              error={errors.participantId}
              id="weigh-in-participant"
              label="Participant identifier"
              onChange={(event) =>
                updateValue('participantId', event.target.value)
              }
              type="text"
              value={values.participantId}
            />
            <TextInput
              error={errors.date}
              id="weigh-in-date"
              label="Date"
              max={todayAsDateOnly()}
              onChange={(event) => updateValue('date', event.target.value)}
              type="date"
              value={values.date}
            />
            <TextInput
              error={errors.weightKg}
              id="weigh-in-weight"
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
                htmlFor="weigh-in-note"
              >
                Note{' '}
                <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                className="mt-2 block min-h-24 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                id="weigh-in-note"
                onChange={(event) => updateValue('note', event.target.value)}
                value={values.note}
              />
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
              <Button type="submit">
                {editingId ? 'Update weigh-in' : 'Save weigh-in'}
              </Button>
              {editingId ? (
                <Button onClick={resetForm} type="button" variant="secondary">
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>

          <div
            aria-live="polite"
            className="mt-6 rounded-2xl bg-stone-50 p-4 text-sm text-slate-600"
          >
            {selectedWeighIn
              ? selectedChange === null
                ? 'No previous weigh-in is available, so no change is calculated.'
                : formatWeightChange(selectedChange)
              : 'No weigh-in recorded for this date; no change is calculated.'}
          </div>

          <Link
            className="mt-6 inline-block text-sm text-emerald-700 underline"
            to="/today"
          >
            Back to today
          </Link>
        </Card>

        <Card
          aria-labelledby="recorded-weigh-ins-title"
          className="p-8 sm:p-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Local preview
          </p>
          <h2
            className="mt-4 text-2xl font-bold tracking-tight text-slate-950"
            id="recorded-weigh-ins-title"
          >
            Recorded weigh-ins
          </h2>
          {participantWeighIns.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              No weigh-ins recorded for this participant yet.
            </p>
          ) : (
            <ul className="mt-5 space-y-3" aria-label="Recorded weigh-ins">
              {participantWeighIns
                .slice()
                .sort((first, second) => second.date.localeCompare(first.date))
                .map((weighIn) => (
                  <li
                    className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                    key={weighIn.id}
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
          <p className="mt-6 text-xs leading-5 text-slate-500">
            This preview is held in memory only and is cleared when the page is
            refreshed.
          </p>
        </Card>
      </div>
    </section>
  )
}

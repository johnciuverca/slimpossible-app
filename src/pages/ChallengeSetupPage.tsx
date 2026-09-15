import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'

type ChallengeSetupErrors = {
  endDate?: string
  name?: string
  startDate?: string
  targetWeightKg?: string
}

type ChallengeSetupValues = {
  description: string
  endDate: string
  name: string
  startDate: string
  targetWeightKg: string
}

const initialValues: ChallengeSetupValues = {
  description: '',
  endDate: '',
  name: '',
  startDate: '',
  targetWeightKg: '',
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function validateChallengeSetup({
  endDate,
  name,
  startDate,
  targetWeightKg,
}: ChallengeSetupValues): ChallengeSetupErrors {
  const errors: ChallengeSetupErrors = {}

  if (!name.trim()) {
    errors.name = 'Enter a challenge name.'
  }

  if (!startDate) {
    errors.startDate = 'Choose a start date.'
  } else if (!isValidDate(startDate)) {
    errors.startDate = 'Enter a valid start date.'
  }

  if (!endDate) {
    errors.endDate = 'Choose an end date.'
  } else if (!isValidDate(endDate)) {
    errors.endDate = 'Enter a valid end date.'
  } else if (isValidDate(startDate) && endDate < startDate) {
    errors.endDate = 'End date must be on or after the start date.'
  }

  if (targetWeightKg) {
    const target = Number(targetWeightKg)
    if (!Number.isFinite(target) || target <= 0) {
      errors.targetWeightKg = 'Target weight must be greater than zero.'
    }
  }

  return errors
}

export function ChallengeSetupPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<ChallengeSetupErrors>({})
  const [isSaved, setIsSaved] = useState(false)

  function updateValue(field: keyof ChallengeSetupValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setIsSaved(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateChallengeSetup(values)
    setErrors(nextErrors)
    setIsSaved(false)

    if (Object.keys(nextErrors).length === 0) {
      setIsSaved(true)
    }
  }

  return (
    <section
      aria-labelledby="challenge-setup-title"
      className="mx-auto flex w-full max-w-2xl flex-1 items-center"
    >
      <Card className="w-full p-8 sm:p-10">
        <PageHeader
          description="Set the dates and target for a shared, sustainable challenge."
          title="Set up your challenge."
          titleId="challenge-setup-title"
        >
          <StatusPill>Local setup</StatusPill>
        </PageHeader>

        <form
          aria-label="Challenge setup form"
          className="mt-8 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <TextInput
            autoComplete="off"
            error={errors.name}
            id="challenge-name"
            label="Challenge name"
            onChange={(event) => updateValue('name', event.target.value)}
            type="text"
            value={values.name}
          />

          <div>
            <label
              className="text-sm font-semibold text-slate-700"
              htmlFor="challenge-description"
            >
              Description{' '}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              className="mt-2 block min-h-28 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              id="challenge-description"
              onChange={(event) =>
                updateValue('description', event.target.value)
              }
              value={values.description}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput
              error={errors.startDate}
              id="challenge-start-date"
              label="Start date"
              onChange={(event) => updateValue('startDate', event.target.value)}
              type="date"
              value={values.startDate}
            />
            <TextInput
              error={errors.endDate}
              id="challenge-end-date"
              label="End date"
              onChange={(event) => updateValue('endDate', event.target.value)}
              type="date"
              value={values.endDate}
            />
          </div>

          <TextInput
            error={errors.targetWeightKg}
            id="challenge-target-weight"
            inputMode="decimal"
            label="Target weight in kg (optional)"
            min="0"
            onChange={(event) =>
              updateValue('targetWeightKg', event.target.value)
            }
            step="0.1"
            type="number"
            value={values.targetWeightKg}
          />

          {isSaved ? (
            <p
              aria-live="polite"
              className="text-sm text-emerald-800"
              role="status"
            >
              Challenge details are valid and ready for local preview. Nothing
              has been saved remotely.
            </p>
          ) : null}

          <Button className="w-full" type="submit">
            Review challenge
          </Button>
        </form>

        <Link
          className="mt-6 inline-block text-sm text-emerald-700 underline"
          to="/"
        >
          Back to home
        </Link>
      </Card>
    </section>
  )
}

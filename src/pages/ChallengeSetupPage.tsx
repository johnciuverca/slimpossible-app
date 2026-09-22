import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  PageHeader,
  StatusPill,
  TextInput,
} from '../components/ui'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'

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

const challengeLoadTimeoutMs = 10_000
const challengeLoadTimeoutMessage =
  'Saved challenges took too long to load. Check your connection and try again.'

function reportChallengeLoadFailure(
  reason: 'request' | 'timeout' | 'unexpected',
) {
  // Keep production diagnostics redacted: no user ids, form values, or provider responses.
  console.warn('[Slimpossible] challenge load failure', { reason })
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
  const { state: authState } = useOptionalAuth()
  const ownerId =
    authState.status === 'signed-in' && authState.user.id
      ? authState.user.id
      : 'local-owner'
  const persistence = useMemo(
    () => createPersistence(authState),
    // Auth object identity can change for duplicate auth events; these are the
    // only values that affect persistence mode and owner-scoped repositories.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authState.status, ownerId],
  )
  const [values, setValues] = useState(initialValues)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState('')
  const [errors, setErrors] = useState<ChallengeSetupErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const previousOwnerId = useRef(ownerId)
  const loadGeneration = useRef(0)
  const activeLoadAbortController = useRef<AbortController | null>(null)

  useEffect(() => {
    let isCurrent = true
    const requestGeneration = ++loadGeneration.current
    const abortController = new AbortController()
    let didTimeout = false
    let timeoutId: number | undefined
    const ownerChanged = previousOwnerId.current !== ownerId
    previousOwnerId.current = ownerId
    activeLoadAbortController.current = abortController

    setIsLoading(true)
    if (ownerChanged) {
      setChallenges([])
      setSelectedChallengeId('')
    }

    async function loadSavedChallenge() {
      try {
        if (persistence.mode === 'unavailable') {
          if (isCurrent) {
            setSubmitError(persistence.message)
            setIsLoading(false)
          }
          return
        }

        const timeoutPromise = new Promise<{ state: 'timeout' }>((resolve) => {
          timeoutId = window.setTimeout(() => {
            didTimeout = true
            abortController.abort()
            resolve({ state: 'timeout' })
          }, challengeLoadTimeoutMs)
        })
        const result = await Promise.race([
          persistence.repositories.challenges.listOwned(ownerId, {
            signal: abortController.signal,
          }),
          timeoutPromise,
        ])
        if (!isCurrent || requestGeneration !== loadGeneration.current) {
          return
        }

        if (result.state === 'timeout' || didTimeout) {
          reportChallengeLoadFailure('timeout')
          setSubmitError(challengeLoadTimeoutMessage)
          setIsLoading(false)
          return
        }

        if (result.state === 'error') {
          reportChallengeLoadFailure('request')
          setSubmitError(result.error.message)
          setIsLoading(false)
          return
        }

        setChallenges(result.state === 'success' ? result.data : [])
        setSubmitError('')
        setIsLoading(false)
      } catch {
        if (!isCurrent || requestGeneration !== loadGeneration.current) {
          return
        }
        reportChallengeLoadFailure('unexpected')
        setSubmitError('Unable to load saved challenges. Try again.')
        setIsLoading(false)
      } finally {
        if (activeLoadAbortController.current === abortController) {
          activeLoadAbortController.current = null
        }
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
      }
    }

    void loadSavedChallenge()
    return () => {
      isCurrent = false
      abortController.abort()
      if (activeLoadAbortController.current === abortController) {
        activeLoadAbortController.current = null
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [ownerId, persistence])

  function selectChallenge(id: string) {
    setSelectedChallengeId(id)
    const challenge = challenges.find((value) => value.id === id)
    setValues(
      challenge
        ? {
            description: challenge.description ?? '',
            endDate: challenge.endDate,
            name: challenge.name,
            startDate: challenge.startDate,
            targetWeightKg: challenge.targetWeightKg?.toString() ?? '',
          }
        : initialValues,
    )
    setErrors({})
    setIsSaved(false)
    setSubmitError('')
  }

  function startNewChallenge() {
    selectChallenge('')
  }

  function updateValue(field: keyof ChallengeSetupValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setIsSaved(false)
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateChallengeSetup(values)
    setErrors(nextErrors)
    setIsSaved(false)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (persistence.mode === 'unavailable') {
      setSubmitError(persistence.message)
      return
    }

    loadGeneration.current += 1
    activeLoadAbortController.current?.abort()
    setIsLoading(false)
    setIsSaving(true)

    const input = {
      createdBy: ownerId,
      ...(values.description.trim()
        ? { description: values.description.trim() }
        : {}),
      endDate: values.endDate,
      name: values.name.trim(),
      ownerId,
      startDate: values.startDate,
      targetWeightKg: values.targetWeightKg
        ? Number(values.targetWeightKg)
        : undefined,
    }
    const result = selectedChallengeId
      ? await persistence.repositories.challenges.update(
          selectedChallengeId,
          input,
        )
      : await persistence.repositories.challenges.create(input)

    setIsSaving(false)

    if (result.state === 'error') {
      setSubmitError(result.error.message)
      return
    }
    if (result.state === 'empty') {
      setSubmitError(
        'The challenge could not be saved because it was not found.',
      )
      return
    }

    setChallenges((currentChallenges) => {
      const existingIndex = currentChallenges.findIndex(
        (challenge) => challenge.id === result.data.id,
      )
      if (existingIndex < 0) return [result.data, ...currentChallenges]
      return currentChallenges.map((challenge) =>
        challenge.id === result.data.id ? result.data : challenge,
      )
    })
    setSelectedChallengeId(result.data.id)
    setIsSaved(true)
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
          <StatusPill>
            {persistence.mode === 'remote'
              ? 'Remote setup'
              : persistence.mode === 'unavailable'
                ? 'Remote unavailable'
                : 'Local setup'}
          </StatusPill>
        </PageHeader>

        <form
          aria-label="Challenge setup form"
          className="mt-8 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          {!isLoading && challenges.length > 0 ? (
            <div>
              <label
                className="text-sm font-semibold text-slate-700"
                htmlFor="saved-challenge"
              >
                Saved challenge
              </label>
              <div className="mt-2 flex flex-wrap gap-3">
                <select
                  className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  id="saved-challenge"
                  onChange={(event) => selectChallenge(event.target.value)}
                  value={selectedChallengeId}
                >
                  <option value="">Create a new challenge</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name}
                    </option>
                  ))}
                </select>
                {selectedChallengeId ? (
                  <Button
                    onClick={startNewChallenge}
                    type="button"
                    variant="secondary"
                  >
                    New challenge
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isLoading && challenges.length === 0 && !submitError ? (
            <p className="text-sm text-slate-600" role="status">
              No saved challenges yet. Create your first challenge below.
            </p>
          ) : null}

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

          {isLoading ? (
            <p
              aria-live="polite"
              className="text-sm text-slate-600"
              role="status"
            >
              Loading saved challenge…
            </p>
          ) : null}

          {submitError ? (
            <p aria-live="polite" className="text-sm text-red-700" role="alert">
              {submitError}
            </p>
          ) : null}

          {isSaved ? (
            <p
              aria-live="polite"
              className="text-sm text-emerald-800"
              role="status"
            >
              {persistence.mode === 'remote'
                ? 'Challenge was saved remotely.'
                : 'Challenge was saved in local preview. Nothing has been saved remotely.'}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={isSaving || persistence.mode === 'unavailable'}
            type="submit"
          >
            {isSaving
              ? 'Saving challenge…'
              : selectedChallengeId
                ? 'Update challenge'
                : 'Save challenge'}
          </Button>
        </form>

        <Link
          className="mt-6 inline-block text-sm text-emerald-700 underline"
          to="/"
        >
          Back to home
        </Link>
        <Link
          className="mt-6 inline-block text-sm text-emerald-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          to="/challenge/participants/enroll"
        >
          Enroll participants
        </Link>
      </Card>
    </section>
  )
}

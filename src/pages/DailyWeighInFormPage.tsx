import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { participantFixture } from '../models/fixtures'
import { sortWeighInsByDate, upsertWeighIn } from '../models/weighInStore'
import type { WeighInValidationField } from '../models/weighIn'
import type { WeighIn } from '../models/weighIn'
import type { ChallengeKind } from '../models/challenge'
import type { Participant } from '../models/participant'
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
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get('challenge')
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const [values, setValues] = useState(initialValues)
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [selectedChallengeName, setSelectedChallengeName] = useState('')
  const [selectedChallengeKind, setSelectedChallengeKind] =
    useState<ChallengeKind | null>(null)
  const [shareWithGroup, setShareWithGroup] = useState(false)
  const [errors, setErrors] = useState<WeighInFormErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasNoEligibleParticipant, setHasNoEligibleParticipant] =
    useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const requestKey = JSON.stringify([
    authState.status,
    authState.user?.id ?? null,
    challengeParam,
    persistence.mode,
  ])
  const [loadedRequestKey, setLoadedRequestKey] = useState('')
  const latestRequestKey = useRef(requestKey)
  latestRequestKey.current = requestKey

  useEffect(() => {
    let isCurrent = true

    setIsLoading(true)
    setParticipant(null)
    setSelectedChallengeName('')
    setSelectedChallengeKind(null)
    setWeighIns([])
    setHasNoEligibleParticipant(false)
    setIsSaving(false)
    setEditingDate(null)
    setValues(initialValues)
    setShareWithGroup(false)
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
    setLoadedRequestKey('')

    function finishLoading() {
      setLoadedRequestKey(requestKey)
      setIsLoading(false)
    }

    async function loadWeighIns() {
      if (persistence.mode === 'local') {
        const [result, visibleChallenges] = await Promise.all([
          persistence.repositories.weighIns.listForParticipant(
            participantFixture.id,
          ),
          persistence.repositories.challenges.listVisibleToUser(
            participantFixture.userId,
          ),
        ])
        if (!isCurrent) {
          return
        }

        setParticipant(participantFixture)
        setSelectedChallengeName(
          visibleChallenges.state === 'success'
            ? (visibleChallenges.data.find(
                ({ id }) => id === participantFixture.challengeId,
              )?.name ?? '')
            : '',
        )
        setSelectedChallengeKind(
          visibleChallenges.state === 'success'
            ? (visibleChallenges.data.find(
                ({ id }) => id === participantFixture.challengeId,
              )?.kind ?? null)
            : null,
        )
        if (result.state === 'error') {
          setSubmitError(result.error.message)
        } else if (result.state === 'success') {
          setWeighIns(result.data)
        }
        finishLoading()
        return
      }

      if (persistence.mode === 'unavailable') {
        if (isCurrent) {
          setSubmitError(persistence.message)
          finishLoading()
        }
        return
      }

      const authenticatedUserId = authState.user?.id
      if (!authenticatedUserId) {
        if (isCurrent) {
          setSubmitError(
            'A signed-in account is required to load saved weigh-ins.',
          )
          finishLoading()
        }
        return
      }

      const [participants, visibleChallenges] = await Promise.all([
        persistence.repositories.participants.listForUser(authenticatedUserId),
        persistence.repositories.challenges.listVisibleToUser(
          authenticatedUserId,
        ),
      ])
      if (!isCurrent) {
        return
      }

      if (participants.state === 'error') {
        setSubmitError(participants.error.message)
        finishLoading()
        return
      }

      const savedParticipant = participants.data.find(
        (candidate) =>
          candidate.userId === authenticatedUserId &&
          (!challengeParam || candidate.challengeId === challengeParam) &&
          candidate.status === 'active',
      )

      if (!savedParticipant) {
        setHasNoEligibleParticipant(true)
        finishLoading()
        return
      }

      setSelectedChallengeName(
        visibleChallenges.state === 'success'
          ? (visibleChallenges.data.find(
              ({ id }) => id === savedParticipant.challengeId,
            )?.name ?? '')
          : '',
      )
      setSelectedChallengeKind(
        visibleChallenges.state === 'success'
          ? (visibleChallenges.data.find(
              ({ id }) => id === savedParticipant.challengeId,
            )?.kind ?? null)
          : null,
      )
      const result = await persistence.repositories.weighIns.listForParticipant(
        savedParticipant.id,
      )
      if (!isCurrent) {
        return
      }

      setParticipant(savedParticipant)
      if (result.state === 'error') {
        setSubmitError(result.error.message)
      } else if (result.state === 'success') {
        setWeighIns(result.data)
      }
      finishLoading()
    }

    void loadWeighIns()
    return () => {
      isCurrent = false
    }
  }, [authState.user?.id, challengeParam, persistence, requestKey])

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
    setShareWithGroup(weighIn.shareWithGroup ?? false)
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  function cancelEditing() {
    setEditingDate(null)
    setValues(initialValues)
    setShareWithGroup(false)
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!participant || loadedRequestKey !== requestKey) {
      return
    }

    const input = {
      date: values.date,
      note: values.note.trim() || undefined,
      participantId: participant.id,
      shareWithGroup: selectedChallengeKind === 'group' && shareWithGroup,
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
    if (latestRequestKey.current !== requestKey) {
      return
    }
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
    setShareWithGroup(false)
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
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="DAILY CHECK-IN"
          description={
            persistence.mode === 'local'
              ? 'A private check-in for the challenge selected in this preview.'
              : 'Record one weigh-in for your currently selected challenge.'
          }
          title="Record a weigh-in"
          titleId="daily-weigh-in-title"
        />
        <StatusPill>
          {persistence.mode === 'remote'
            ? 'Remote data'
            : persistence.mode === 'unavailable'
              ? 'Remote unavailable'
              : 'Local storage'}
        </StatusPill>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card className="p-6 sm:p-8">
          <div className="mb-7 rounded-2xl border border-forest-200 bg-forest-50 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-800">
              Active destination
            </p>
            <h2
              className="mt-2 text-xl font-bold text-ink"
              id="selected-weigh-in-challenge"
            >
              {selectedChallengeName || 'Selected challenge'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Only this selected challenge receives the weigh-in. No second
              destination is active.
            </p>
            <button
              aria-label="Additional destination, coming soon"
              aria-describedby="second-destination-copy"
              className="mt-4 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-between rounded-xl border border-dashed border-line bg-panel px-4 py-3 text-left text-sm font-semibold text-ink-muted opacity-70 sm:w-auto sm:min-w-64"
              disabled
              type="button"
            >
              <span>Additional destination</span>
              <span className="rounded-full border border-line px-2 py-1 text-xs font-bold uppercase tracking-wide">
                Coming soon
              </span>
            </button>
            <p
              className="mt-2 text-xs leading-5 text-ink-muted"
              id="second-destination-copy"
            >
              This option is unavailable and will not be saved.
            </p>
          </div>

          <p className="text-sm text-ink-muted">
            Participant:{' '}
            <strong className="text-ink">
              {participant?.displayName ?? 'Not available'}
            </strong>
          </p>

          {isLoading || loadedRequestKey !== requestKey ? (
            <p
              aria-live="polite"
              className="mt-8 text-sm text-ink-muted"
              role="status"
            >
              Loading your selected challenge and saved weigh-ins…
            </p>
          ) : hasNoEligibleParticipant ? (
            <div className="mt-8 space-y-4">
              <p
                aria-live="polite"
                className="text-sm text-ink-muted"
                role="status"
              >
                No saved participant is available for this account. Set up a
                challenge and enroll yourself before recording a weigh-in.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="text-sm font-semibold text-forest-800 underline"
                  to="/challenge/setup"
                >
                  Set up a challenge
                </Link>
                <Link
                  className="text-sm font-semibold text-forest-800 underline"
                  to={
                    challengeParam
                      ? `/challenge/participants/enroll?challenge=${encodeURIComponent(challengeParam)}`
                      : '/challenge/participants/enroll'
                  }
                >
                  Enroll a participant
                </Link>
              </div>
            </div>
          ) : participant ? (
            <form
              aria-label="Daily weigh-in form"
              className="mt-7 space-y-5"
              noValidate
              onSubmit={handleSubmit}
            >
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
                onChange={(event) =>
                  updateValue('weightKg', event.target.value)
                }
                step="0.1"
                type="number"
                value={values.weightKg}
              />

              <div>
                <label
                  className="text-sm font-semibold text-ink"
                  htmlFor="daily-weigh-in-note"
                >
                  Private note{' '}
                  <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <textarea
                  aria-describedby={
                    errors.note ? 'daily-weigh-in-note-error' : undefined
                  }
                  aria-invalid={errors.note ? true : undefined}
                  className="mt-2 block min-h-32 w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink outline-none transition placeholder:text-ink-muted focus:border-forest-700 focus:ring-2 focus:ring-forest-100"
                  id="daily-weigh-in-note"
                  onChange={(event) => updateValue('note', event.target.value)}
                  value={values.note}
                />
                <p className="mt-2 text-xs leading-5 text-ink-muted">
                  Only you can see this note. It is never included in group
                  views.
                </p>
                {errors.note ? (
                  <p
                    className="mt-2 text-sm text-red-700"
                    id="daily-weigh-in-note-error"
                  >
                    {errors.note}
                  </p>
                ) : null}
              </div>

              {selectedChallengeKind === 'group' ? (
                <div className="rounded-xl border border-forest-200 bg-forest-50 p-4">
                  <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                    <input
                      checked={shareWithGroup}
                      className="mt-1 size-4 accent-forest-800"
                      onChange={(event) =>
                        setShareWithGroup(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      Share this date and weight with this group’s active
                      members and owner.
                    </span>
                  </label>
                  <p className="ml-7 mt-2 text-xs leading-5 text-ink-muted">
                    This is optional. Your private note is never shared. Older
                    entries stay private unless you edit and opt in; you can
                    uncheck this later to remove an entry from group history.
                  </p>
                </div>
              ) : null}

              {successMessage ? (
                <p
                  aria-live="polite"
                  className="text-sm text-forest-800"
                  role="status"
                >
                  {successMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={isSaving} type="submit">
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
          ) : null}

          {submitError ? (
            <p
              aria-live="polite"
              className="mt-8 text-sm text-red-700"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card aria-labelledby="weigh-in-privacy-title" className="p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-800">
              Current sharing rules
            </p>
            <h2
              className="mt-2 text-xl font-bold text-ink"
              id="weigh-in-privacy-title"
            >
              Your note stays private
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Active members and the owner can see dates and weights you
              explicitly choose to share in a group challenge. They never see
              your private notes; unchecked entries stay private.
            </p>
            <dl className="mt-5 divide-y divide-line rounded-xl border border-line bg-page px-4">
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-ink-muted">Your note</dt>
                <dd className="text-sm font-semibold text-forest-800">
                  Only you
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-ink-muted">Second destination</dt>
                <dd className="text-sm font-semibold text-ink-muted">
                  Not active
                </dd>
              </div>
            </dl>
          </Card>

          <Card aria-labelledby="saved-weigh-ins-title" className="p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest-800">
              {persistence.mode === 'remote' ? 'Saved data' : 'Local preview'}
            </p>
            <h2
              className="mt-2 text-xl font-bold text-ink"
              id="saved-weigh-ins-title"
            >
              Your saved weigh-ins
            </h2>
            {isLoading || loadedRequestKey !== requestKey ? (
              <p
                aria-live="polite"
                className="mt-5 text-sm text-ink-muted"
                role="status"
              >
                Loading saved weigh-ins…
              </p>
            ) : weighIns.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-ink-muted">
                No weigh-ins saved yet.
              </p>
            ) : (
              <ul className="mt-5 space-y-3" aria-label="Saved weigh-ins">
                {sortWeighInsByDate(weighIns).map((weighIn) => (
                  <li
                    className="rounded-xl border border-line bg-page p-4"
                    key={`${weighIn.participantId}-${weighIn.date}`}
                  >
                    <p className="font-semibold text-ink">
                      {weighIn.date}: {weighIn.weightKg} kg
                    </p>
                    {weighIn.note ? (
                      <p className="mt-1 text-sm text-ink-muted">
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
            <p className="mt-5 text-sm leading-6 text-ink-muted">
              Missing calendar days stay absent; no record or change is created
              for them.
            </p>
            <p className="mt-5 text-xs leading-5 text-ink-muted">
              {persistence.mode === 'remote'
                ? 'These entries are loaded from your selected participant’s authorized records.'
                : 'This local preview is stored in this browser and is available after refresh.'}
            </p>
          </Card>
        </div>
      </div>

      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"
        to={
          (participant?.challengeId ?? challengeParam)
            ? `/today?challenge=${encodeURIComponent(participant?.challengeId ?? challengeParam ?? '')}`
            : '/today'
        }
      >
        Back to today
      </Link>
    </section>
  )
}

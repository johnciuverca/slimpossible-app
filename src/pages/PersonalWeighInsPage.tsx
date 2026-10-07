import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button, Card, PageHeader, StatusPill } from '../components/ui'
import {
  PersonalWeighInEditor,
  type PersonalWeighInFormValues,
} from '../components/PersonalWeighInEditor'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'
import { participantFixture } from '../models/fixtures'
import type { PersonalWeighIn } from '../models/personalWeighIn'
import { validatePersonalWeighIn } from '../models/personalWeighIn'

const emptyForm: PersonalWeighInFormValues = {
  date: new Date().toISOString().slice(0, 10),
  note: '',
  sharedChallengeIds: [],
  weightKg: '',
}

export function PersonalWeighInsPage() {
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const userId =
    persistence.mode === 'remote'
      ? (authState.user?.id ?? '')
      : participantFixture.userId
  const requestKey = `${authState.user?.id ?? 'local'}:${persistence.mode}`
  const latestRequestKey = useRef(requestKey)
  latestRequestKey.current = requestKey

  const [entries, setEntries] = useState<PersonalWeighIn[]>([])
  const [groups, setGroups] = useState<Challenge[]>([])
  const [values, setValues] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<
    Partial<Record<keyof PersonalWeighInFormValues, string>>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [groupsError, setGroupsError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let current = true
    setIsLoading(true)
    setIsSaving(false)
    setEntries([])
    setGroups([])
    setValues(emptyForm)
    setEditingId(null)
    setLoadError('')
    setGroupsError('')
    setSubmitError('')
    setSuccess('')

    async function load() {
      if (persistence.mode === 'unavailable') {
        if (current) {
          setLoadError(persistence.message)
          setIsLoading(false)
        }
        return
      }

      const [entriesResult, groupsResult] = await Promise.all([
        persistence.repositories.personalWeighIns.listForUser(userId),
        persistence.repositories.challenges.listVisibleToUser(userId),
      ])
      if (!current) return
      if (entriesResult.state === 'error') {
        setLoadError(entriesResult.error.message)
      } else if (entriesResult.state === 'success') {
        setEntries(entriesResult.data)
      }
      if (groupsResult.state === 'error') {
        setGroupsError(
          'Group choices could not be loaded. You can still save privately.',
        )
      } else if (groupsResult.state === 'success') {
        setGroups(
          groupsResult.data.filter(
            (challenge) =>
              challenge.kind === 'group' && challenge.status === 'active',
          ),
        )
      }
      setIsLoading(false)
    }

    void load()
    return () => {
      current = false
    }
  }, [persistence, requestKey, userId])

  function updateValue(
    field: keyof PersonalWeighInFormValues,
    value: string | string[],
  ) {
    setValues((current) =>
      field === 'sharedChallengeIds'
        ? { ...current, sharedChallengeIds: Array.isArray(value) ? value : [] }
        : { ...current, [field]: String(value) },
    )
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError('')
    setSuccess('')
  }

  function startEditing(entry: PersonalWeighIn) {
    const eligibleIds = new Set(groups.map(({ id }) => id))
    const unavailableShares = entry.sharedChallengeIds.some(
      (id) => !eligibleIds.has(id),
    )
    setEditingId(entry.id)
    setValues({
      date: entry.date,
      note: entry.note ?? '',
      sharedChallengeIds: entry.sharedChallengeIds.filter((id) =>
        eligibleIds.has(id),
      ),
      weightKg: String(entry.weightKg),
    })
    setSubmitError(
      unavailableShares
        ? 'A previous group share is no longer eligible. Saving will remove that unavailable share.'
        : '',
    )
    setErrors({})
    setSuccess('')
  }

  function cancelEditing() {
    setEditingId(null)
    setValues(emptyForm)
    setErrors({})
    setSubmitError('')
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (persistence.mode === 'unavailable' || !userId) {
      setSubmitError(
        persistence.mode === 'unavailable'
          ? persistence.message
          : 'A signed-in user is required to save a weigh-in.',
      )
      return
    }
    const input = {
      ...(editingId ? { id: editingId } : {}),
      date: values.date,
      note: values.note.trim() || undefined,
      sharedChallengeIds: values.sharedChallengeIds,
      weightKg: Number(values.weightKg),
    }
    const validation = validatePersonalWeighIn(input)
    if (!validation.success) {
      const next: typeof errors = {}
      validation.issues.forEach(({ field, message }) => {
        if (field !== 'id') next[field] = message
      })
      setErrors(next)
      setSubmitError('Please correct the highlighted fields before saving.')
      setSuccess('')
      return
    }

    setIsSaving(true)
    setSubmitError('')
    setSuccess('')
    const saveResult = await persistence.repositories.personalWeighIns.save(
      userId,
      validation.data,
    )
    if (latestRequestKey.current !== requestKey) return
    setIsSaving(false)
    if (saveResult.state === 'error') {
      setSubmitError(
        saveResult.error.code === '23505'
          ? 'A weigh-in already exists for that date. Edit that entry instead.'
          : saveResult.error.message,
      )
      return
    }
    if (saveResult.state === 'empty') {
      setSubmitError('That weigh-in could not be saved.')
      return
    }
    const reloaded =
      await persistence.repositories.personalWeighIns.listForUser(userId)
    if (latestRequestKey.current !== requestKey) return
    if (reloaded.state === 'success') setEntries(reloaded.data)
    else if (reloaded.state === 'empty') setEntries([])
    setEditingId(null)
    setValues(emptyForm)
    setErrors({})
    setSuccess(
      persistence.mode === 'remote'
        ? 'Personal weigh-in saved.'
        : 'Personal weigh-in saved in this browser.',
    )
  }

  async function deleteEntry(entry: PersonalWeighIn) {
    if (
      !window.confirm(
        `Delete the weigh-in for ${entry.date}? This also removes its group shares.`,
      )
    ) {
      return
    }
    if (persistence.mode === 'unavailable') {
      setSubmitError(persistence.message)
      return
    }
    setSubmitError('')
    const result = await persistence.repositories.personalWeighIns.delete(
      userId,
      entry.id,
    )
    if (latestRequestKey.current !== requestKey) return
    if (result.state === 'error') {
      setSubmitError(result.error.message)
      return
    }
    setEntries((current) => current.filter(({ id }) => id !== entry.id))
    if (editingId === entry.id) cancelEditing()
    setSuccess('Weigh-in and its group shares were deleted.')
  }

  return (
    <section
      aria-labelledby="personal-weigh-ins-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="PERSONAL CHECK-IN"
          description="Your weigh-ins belong to you. A group is optional, and sharing is always explicit."
          title="Record a weigh-in"
          titleId="personal-weigh-ins-title"
        />
        <StatusPill>
          {persistence.mode === 'remote'
            ? 'Remote data'
            : persistence.mode === 'local'
              ? 'Local storage'
              : 'Remote unavailable'}
        </StatusPill>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <Card className="p-6 sm:p-8">
          <h2 className="mb-5 text-xl font-bold text-ink">
            {editingId ? 'Edit personal weigh-in' : 'Your personal entry'}
          </h2>
          {groupsError ? (
            <p className="mb-4 text-sm text-amber-800" role="status">
              {groupsError}
            </p>
          ) : null}
          {loadError ? (
            <p className="mb-4 text-sm text-red-700" role="alert">
              {loadError}
            </p>
          ) : null}
          {isLoading ? (
            <p aria-live="polite" role="status">
              Loading your personal weigh-ins…
            </p>
          ) : !loadError ? (
            <PersonalWeighInEditor
              errors={errors}
              groups={groups}
              isSaving={isSaving}
              onCancel={editingId ? cancelEditing : undefined}
              onChange={updateValue}
              onSubmit={handleSubmit}
              submitLabel={editingId ? 'Update weigh-in' : 'Save weigh-in'}
              values={values}
            />
          ) : null}
          {submitError ? (
            <p
              aria-live="polite"
              className="mt-5 text-sm text-red-700"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
          {success ? (
            <p
              aria-live="polite"
              className="mt-5 text-sm text-forest-800"
              role="status"
            >
              {success}
            </p>
          ) : null}
        </Card>

        <Card aria-labelledby="personal-history-title" className="p-6 sm:p-8">
          <h2
            className="text-xl font-bold text-ink"
            id="personal-history-title"
          >
            Your saved weigh-ins
          </h2>
          {isLoading ? (
            <p
              aria-live="polite"
              className="mt-5 text-sm text-ink-muted"
              role="status"
            >
              Loading saved weigh-ins…
            </p>
          ) : entries.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-ink-muted">
              No personal weigh-ins saved yet. You can record one without
              joining a challenge.
            </p>
          ) : (
            <ul
              aria-label="Personal weigh-in history"
              className="mt-5 space-y-3"
            >
              {[...entries]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <li
                    className="rounded-xl border border-line bg-page p-4"
                    key={entry.id}
                  >
                    <p className="font-semibold text-ink">
                      {entry.date}: {entry.weightKg} kg
                    </p>
                    {entry.note ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                        {entry.note}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-muted">
                      {entry.sharedChallengeIds.length === 0
                        ? 'Private — not shared with a group'
                        : `Shared with ${entry.sharedChallengeIds.map((id) => groups.find((group) => group.id === id)?.name ?? 'an unavailable group').join(', ')}`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => startEditing(entry)}
                        type="button"
                        variant="secondary"
                      >
                        Edit {entry.date}
                      </Button>
                      <Button
                        onClick={() => void deleteEntry(entry)}
                        type="button"
                        variant="secondary"
                      >
                        Delete {entry.date}
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-5 text-xs leading-5 text-ink-muted">
            Entries are one per calendar date. Editing a date already in use is
            rejected instead of overwriting another entry. Notes remain private.
          </p>
        </Card>
      </div>

      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800 underline"
        to="/today"
      >
        Back to today
      </Link>
    </section>
  )
}

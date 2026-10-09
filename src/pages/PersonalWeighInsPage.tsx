import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button, Card, PageHeader, StatusPill } from '../components/ui'
import { WeightPageHeader } from '../components/WeightPageHeader'
import { PersonalWeightRecordCard } from '../components/PersonalWeightRecordCard'
import { DeleteWeightDialog } from '../components/DeleteWeightDialog'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import { notifyPersonalWeightChange } from '../data/personalWeightChanges'
import {
  PersonalWeighInEditor,
  type PersonalWeighInFormValues,
} from '../components/PersonalWeighInEditor'
import { useOptionalAuth } from '../auth/useAuth'
import { createPersistence } from '../data/persistence'
import type { Challenge } from '../models/challenge'
import { isEligibleSharingGroup } from '../models/groupSharingEligibility'
import { participantFixture } from '../models/fixtures'
import type { PersonalWeighIn } from '../models/personalWeighIn'
import {
  personalWeighInToday,
  validatePersonalWeighIn,
} from '../models/personalWeighIn'

const emptyForm: PersonalWeighInFormValues = {
  date: personalWeighInToday(),
  note: '',
  sharedChallengeIds: [],
  weightKg: '',
}

export function PersonalWeighInsPage() {
  const workspace = usePersonalWorkspace()
  const [deleteTarget, setDeleteTarget] = useState<{
    key: string
    entry: PersonalWeighIn
  } | null>(null)
  const { state: authState } = useOptionalAuth()
  const persistence = useMemo(() => createPersistence(authState), [authState])
  const userId =
    persistence.mode === 'remote'
      ? (authState.user?.id ?? '')
      : (authState.user?.id ?? participantFixture.userId)
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
  const [sharesWarning, setSharesWarning] = useState('')
  const [success, setSuccess] = useState('')
  const editorRegion = useRef<HTMLDivElement>(null)
  const draftChanged = useRef(false)
  const [focusRevision, setFocusRevision] = useState(0)
  useEffect(() => {
    if (!focusRevision) return
    editorRegion.current?.scrollIntoView?.({
      block: 'start',
      behavior: 'instant',
    })
    editorRegion.current
      ?.querySelector<HTMLInputElement>('input[type="number"]')
      ?.focus({ preventScroll: true })
  }, [focusRevision])

  useEffect(() => {
    let current = true
    setIsLoading(true)
    setIsSaving(false)
    setDeleteTarget(null)
    setEntries([])
    setGroups([])
    setValues(emptyForm)
    draftChanged.current = false
    setEditingId(null)
    setLoadError('')
    setGroupsError('')
    setSubmitError('')
    setSharesWarning('')
    setSuccess('')

    async function load() {
      if (persistence.mode === 'unavailable') {
        if (current) {
          setLoadError(persistence.message)
          setIsLoading(false)
        }
        return
      }

      const [entriesResult, groupsResult, participantsResult] =
        await Promise.all([
          persistence.repositories.personalWeighIns.listForUser(userId),
          persistence.repositories.challenges.listVisibleToUser(userId),
          persistence.repositories.participants.listForUser(userId),
        ])
      if (!current) return
      if (entriesResult.state === 'error') {
        setLoadError(entriesResult.error.message)
      } else if (entriesResult.state === 'success') {
        setEntries(entriesResult.data)
      }
      if (
        groupsResult.state === 'error' ||
        participantsResult.state === 'error'
      ) {
        setGroupsError(
          'Group choices could not be loaded. You can still save privately.',
        )
      } else if (groupsResult.state === 'success') {
        setGroups(
          groupsResult.data.filter((challenge) =>
            isEligibleSharingGroup(challenge, userId, participantsResult.data),
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
    draftChanged.current = true
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
    if (groupsError && entry.sharedChallengeIds.length > 0) {
      setSubmitError(
        'Group choices could not be verified. Reload before editing a shared entry; its existing shares have not changed.',
      )
      return
    }
    const eligibleIds = new Set(groups.map(({ id }) => id))
    const unavailableShares = entry.sharedChallengeIds.some(
      (id) => !eligibleIds.has(id),
    )
    setEditingId(entry.id)
    setFocusRevision((value) => value + 1)
    draftChanged.current = false
    setValues({
      date: entry.date,
      note: entry.note ?? '',
      sharedChallengeIds: entry.sharedChallengeIds.filter((id) =>
        eligibleIds.has(id),
      ),
      weightKg: String(entry.weightKg),
    })
    setSubmitError('')
    setSharesWarning(
      unavailableShares
        ? 'A previous group share is no longer eligible. Saving will remove that unavailable share.'
        : '',
    )
    setErrors({})
    setSuccess('')
    editorRegion.current?.scrollIntoView?.({
      block: 'start',
      behavior: 'instant',
    })
    editorRegion.current
      ?.querySelector<HTMLInputElement>('input[type="number"]')
      ?.focus({ preventScroll: true })
  }

  function cancelEditing() {
    draftChanged.current = false
    setEditingId(null)
    setValues(emptyForm)
    setErrors({})
    setSubmitError('')
    setSharesWarning('')
    setSuccess('')
  }

  function recordWeight() {
    setFocusRevision((value) => value + 1)
    // The header action resumes unfinished input rather than replacing it.
    if (!draftChanged.current) {
      const todayEntry = entries.find(
        ({ date }) => date === personalWeighInToday(),
      )
      if (todayEntry) startEditing(todayEntry)
      else cancelEditing()
    }
    editorRegion.current?.scrollIntoView?.({
      block: 'start',
      behavior: 'instant',
    })
    editorRegion.current
      ?.querySelector<HTMLInputElement>('input[type="number"]')
      ?.focus({ preventScroll: true })
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
    const existingEntry = entries.find((entry) =>
      editingId ? entry.id === editingId : entry.date === values.date,
    )
    if (groupsError && existingEntry?.sharedChallengeIds.length) {
      setSubmitError(
        'Group choices could not be verified. Reload before correcting a shared entry; its existing shares have not changed.',
      )
      return
    }
    if (!editingId && existingEntry) {
      setSubmitError(
        'An entry already exists for that date. Edit the saved record to preserve its note and sharing.',
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

    if (
      sharesWarning &&
      !window.confirm(
        'Save this correction and remove shares to groups that are no longer eligible?',
      )
    )
      return
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
    draftChanged.current = false
    setSharesWarning('')
    setValues(emptyForm)
    setErrors({})
    notifyPersonalWeightChange(userId)
    setSuccess(
      persistence.mode === 'remote'
        ? 'Personal weigh-in saved.'
        : 'Personal weigh-in saved in this browser.',
    )
  }

  return (
    <section
      aria-labelledby="personal-weigh-ins-title"
      className="mx-auto w-full max-w-6xl space-y-6"
    >
      <WeightPageHeader
        action={
          <Button
            data-weight-owner={workspace.ownerKey}
            disabled={isLoading || !!loadError || isSaving}
            onClick={recordWeight}
          >
            Record weight
          </Button>
        }
      >
        <PageHeader
          eyebrow="PERSONAL CHECK-IN"
          description="Your weigh-ins belong to you. A group is optional, and sharing is always explicit."
          title={editingId ? 'Edit weight' : 'Record weight'}
          titleId="personal-weigh-ins-title"
        >
          <StatusPill>
            {persistence.mode === 'remote'
              ? 'Remote data'
              : persistence.mode === 'local'
                ? 'Local storage'
                : 'Remote unavailable'}
          </StatusPill>
        </PageHeader>
      </WeightPageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div ref={editorRegion} className="min-w-0 scroll-mt-6">
          <Card className="p-6 sm:p-8">
            <h2 className="mb-5 text-xl font-bold text-ink">Weight details</h2>
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
                key={editingId ?? 'new'}
                errors={errors}
                groups={groups}
                isSaving={isSaving}
                onCancel={editingId ? cancelEditing : undefined}
                onChange={updateValue}
                onSubmit={handleSubmit}
                submitLabel={editingId ? 'Update weight' : 'Save weight'}
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
            {sharesWarning ? (
              <p className="mt-5 text-sm text-amber-800" role="status">
                {sharesWarning}
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
        </div>

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
                  <PersonalWeightRecordCard
                    key={entry.id}
                    entry={entry}
                    groupName={(id) =>
                      groups.find((group) => group.id === id)?.name ??
                      'an unavailable group'
                    }
                    onEdit={() => startEditing(entry)}
                    onDelete={() =>
                      setDeleteTarget({ key: workspace.ownerKey, entry })
                    }
                    disabled={isSaving}
                  />
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
      {deleteTarget?.key === workspace.ownerKey ? (
        <DeleteWeightDialog
          key={`${deleteTarget.key}:${deleteTarget.entry.id}`}
          workspace={workspace}
          entry={deleteTarget.entry}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            const entry = deleteTarget.entry
            setDeleteTarget(null)
            setEntries((current) => current.filter(({ id }) => id !== entry.id))
            if (editingId === entry.id) cancelEditing()
            setSuccess('Weigh-in and its group shares were deleted.')
            workspace.refresh()
          }}
        />
      ) : null}
    </section>
  )
}

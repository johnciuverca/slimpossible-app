import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from './ui'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { trapDialogFocus } from './dialogFocus'
import {
  PersonalWeighInEditor,
  type PersonalWeighInFormValues,
} from './PersonalWeighInEditor'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import {
  personalWeighInToday,
  validatePersonalWeighIn,
  type PersonalWeighIn,
} from '../models/personalWeighIn'

export function RecordWeightDialog({
  workspace,
  entry,
  onClose,
  onSaved,
}: {
  workspace: PersonalWorkspace
  entry?: PersonalWeighIn
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const active = useRef(true)
  const groups = workspace.groups
  const eligibleIds = new Set(groups.map(({ id }) => id))
  const unavailable =
    entry?.sharedChallengeIds.some((id) => !eligibleIds.has(id)) ?? false
  const blocked =
    workspace.contexts.state !== 'ready' && !!entry?.sharedChallengeIds.length
  const [values, setValues] = useState<PersonalWeighInFormValues>({
    date: entry?.date ?? personalWeighInToday(),
    weightKg: entry ? String(entry.weightKg) : '',
    note: entry?.note ?? '',
    sharedChallengeIds: entry?.sharedChallengeIds ?? [],
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof PersonalWeighInFormValues, string>>
  >({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const initial = useRef(JSON.stringify(values))
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    active.current = true
    const element = dialog.current
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element?.showModal()
    element?.querySelector<HTMLInputElement>('input[type="number"]')?.focus()
    return () => {
      active.current = false
      element?.close()
    }
  }, [])

  function dismiss() {
    if (saving || !active.current) return
    if (JSON.stringify(values) !== initial.current) {
      setConfirmDiscard(true)
      return
    }
    closeEditor()
  }

  function closeEditor() {
    // Close while the dialog is still attached so native modal state is cleared.
    // Only an explicit dismissal restores focus; account-switch cleanup must not
    // focus a trigger belonging to the previous account.
    dialog.current?.close()
    if (trigger.current?.isConnected) trigger.current.focus()
    onClose()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      saving ||
      blocked ||
      workspace.personal.state !== 'ready' ||
      (entry && !workspace.personal.data.some(({ id }) => id === entry.id)) ||
      workspace.persistence.mode === 'unavailable'
    )
      return
    if (
      !entry &&
      workspace.personal.data.some((saved) => saved.date === values.date)
    ) {
      setError(
        'An entry already exists for that date. Edit it from My Progress instead; its sharing has not changed.',
      )
      return
    }
    const validation = validatePersonalWeighIn({
      ...(entry ? { id: entry.id } : {}),
      date: values.date,
      weightKg: Number(values.weightKg),
      note: values.note.trim() || undefined,
      sharedChallengeIds: values.sharedChallengeIds.filter((id) =>
        eligibleIds.has(id),
      ),
    })
    if (!validation.success) {
      const next: typeof errors = {}
      validation.issues.forEach(({ field, message }) => {
        if (field !== 'id') next[field] = message
      })
      setErrors(next)
      return
    }
    if (
      unavailable &&
      !window.confirm(
        'Save this correction and remove shares to groups that are no longer eligible?',
      )
    )
      return
    setSaving(true)
    setError('')
    try {
      const result =
        await workspace.persistence.repositories.personalWeighIns.save(
          workspace.userId,
          validation.data,
        )
      if (!active.current) return
      if (result.state !== 'success') {
        setError(
          result.state === 'error' && result.error.code === '23505'
            ? 'Another entry already uses that date. Choose an unused date.'
            : 'Your weigh-in could not be saved. No successful save was confirmed; try again.',
        )
        setSaving(false)
        return
      }
      dialog.current?.close()
      if (trigger.current?.isConnected) trigger.current.focus()
      onSaved()
    } catch {
      if (active.current) {
        setError('Your weigh-in could not be saved. Try again.')
        setSaving(false)
      }
    }
  }

  return (
    <>
      <dialog
        ref={dialog}
        onKeyDown={trapDialogFocus}
        aria-labelledby="record-weight-title"
        aria-describedby="record-weight-description"
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 text-ink shadow-panel backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="record-weight-title" className="text-2xl font-extrabold">
              {entry ? 'Edit weight' : 'Record weight'}
            </h2>
            <p
              id="record-weight-description"
              className="mt-2 text-sm text-ink-muted"
            >
              One personal entry per date. Your note stays private. A challenge
              is never required.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={dismiss}
            aria-label="Close weight editor"
          >
            Close
          </Button>
        </div>
        {workspace.contexts.state === 'loading' ? (
          <p role="status" className="mb-4">
            Loading optional group choices…
          </p>
        ) : null}
        {workspace.contexts.error ? (
          <p role="status" className="mb-4 text-warning-800">
            {workspace.contexts.error}
          </p>
        ) : null}
        {blocked ? (
          <p role="alert">
            Group choices could not be verified. Refresh before editing this
            shared entry; existing shares have not changed.
          </p>
        ) : (
          <>
            {unavailable ? (
              <p role="status" className="mb-4 text-warning-800">
                A previous group share is no longer eligible. Saving will remove
                that unavailable share only after confirmation.
              </p>
            ) : null}
            <PersonalWeighInEditor
              values={values}
              groups={groups}
              errors={errors}
              isSaving={saving}
              onCancel={dismiss}
              onSubmit={submit}
              submitLabel={entry ? 'Update weight' : 'Save weight'}
              onChange={(field, value) => {
                setValues((current) =>
                  field === 'sharedChallengeIds'
                    ? {
                        ...current,
                        sharedChallengeIds: Array.isArray(value) ? value : [],
                      }
                    : { ...current, [field]: String(value) },
                )
                setErrors((current) => ({ ...current, [field]: undefined }))
                setError('')
              }}
            />
          </>
        )}
        {error ? (
          <p role="alert" className="mt-4 text-danger-800">
            {error}
          </p>
        ) : null}
      </dialog>
      {confirmDiscard ? (
        <UnsavedChangesDialog
          onStay={() => setConfirmDiscard(false)}
          onDiscard={closeEditor}
        />
      ) : null}
    </>
  )
}

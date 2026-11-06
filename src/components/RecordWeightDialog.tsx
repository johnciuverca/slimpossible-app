import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from './ui'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { focusAfterWeightMutation, trapDialogFocus } from './dialogFocus'
import { useUnsavedNavigation } from './navigationSafety'
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

const pageScrollProperties = [
  'overflow',
  'overscroll-behavior',
  'position',
  'top',
  'left',
  'right',
  'width',
] as const

function lockPageScroll() {
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const elements = [document.documentElement, document.body]
  const previousStyles = elements.map((element) =>
    pageScrollProperties.map((property) => ({
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    })),
  )

  document.documentElement.style.setProperty('overflow', 'hidden')
  document.documentElement.style.setProperty('overscroll-behavior', 'none')
  document.body.style.setProperty('position', 'fixed')
  document.body.style.setProperty('top', `${-scrollY}px`)
  document.body.style.setProperty('left', `${-scrollX}px`)
  document.body.style.setProperty('right', '0')
  document.body.style.setProperty('width', '100%')
  document.body.style.setProperty('overflow', 'hidden')
  document.body.style.setProperty('overscroll-behavior', 'none')

  let restored = false
  return () => {
    if (restored) return
    restored = true
    elements.forEach((element, elementIndex) => {
      previousStyles[elementIndex].forEach(({ property, value, priority }) => {
        if (value) element.style.setProperty(property, value, priority)
        else element.style.removeProperty(property)
      })
    })
    if (window.scrollX !== scrollX || window.scrollY !== scrollY)
      window.scrollTo(scrollX, scrollY)
  }
}

export function RecordWeightDialog({
  workspace,
  entry,
  initialValues,
  estimateNotice,
  onDuplicateDate,
  onClose,
  onSaved,
}: {
  workspace: PersonalWorkspace
  entry?: PersonalWeighIn
  initialValues?: Partial<PersonalWeighInFormValues>
  estimateNotice?: string
  onDuplicateDate?: (date: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const restorePageScroll = useRef<(() => void) | null>(null)
  const active = useRef(true)
  const groups = workspace.groups
  const eligibleIds = new Set(groups.map(({ id }) => id))
  const unavailable =
    entry?.sharedChallengeIds.some((id) => !eligibleIds.has(id)) ?? false
  const blocked =
    workspace.contexts.state !== 'ready' && !!entry?.sharedChallengeIds.length
  const [values, setValues] = useState<PersonalWeighInFormValues>({
    date: entry?.date ?? initialValues?.date ?? personalWeighInToday(),
    weightKg: entry ? String(entry.weightKg) : (initialValues?.weightKg ?? ''),
    note: entry?.note ?? initialValues?.note ?? '',
    sharedChallengeIds:
      entry?.sharedChallengeIds ?? initialValues?.sharedChallengeIds ?? [],
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof PersonalWeighInFormValues, string>>
  >({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const initial = useRef(JSON.stringify(values))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useUnsavedNavigation(
    saving
      ? 'saving'
      : JSON.stringify(values) !== initial.current
        ? 'dirty'
        : null,
  )

  useEffect(() => {
    active.current = true
    const element = dialog.current
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const restoreScroll = lockPageScroll()
    restorePageScroll.current = restoreScroll
    element?.showModal()
    const viewport = window.visualViewport
    const wideViewport =
      (window.matchMedia?.('(min-width: 768px) and (min-height: 501px)')
        .matches ??
        (window.innerWidth >= 768 && window.innerHeight > 500)) &&
      (!viewport ||
        (viewport.width >= 768 &&
          viewport.height > 500 &&
          viewport.scale <= 1.05))
    if (wideViewport)
      element?.querySelector<HTMLInputElement>('input[type="number"]')?.focus()
    else element?.focus()
    return () => {
      active.current = false
      element?.close()
      restoreScroll()
      restorePageScroll.current = null
    }
  }, [])

  useEffect(() => {
    if (!dialog.current) return
    const element = dialog.current
    const viewport = window.visualViewport
    const compactViewport = window.matchMedia?.(
      '(max-width: 767px), (max-height: 500px)',
    )
    const updateViewport = () => {
      const isCompact =
        compactViewport?.matches ??
        (window.innerWidth < 768 || window.innerHeight <= 500)
      const compactVisualViewport =
        !!viewport &&
        (viewport.width < 768 ||
          viewport.height <= 500 ||
          viewport.scale > 1.05)
      if ((!isCompact && !compactVisualViewport) || !viewport) {
        element.removeAttribute('data-compact-viewport')
        element.removeAttribute('data-narrow-fields')
        element.style.removeProperty('--record-weight-available-height')
        element.style.removeProperty('bottom')
        return
      }
      element.setAttribute('data-compact-viewport', '')
      const stackFields =
        window.innerWidth < 400 ||
        window.innerHeight <= 500 ||
        (!!viewport &&
          (viewport.width < 400 ||
            viewport.height <= 500 ||
            viewport.scale > 1.05))
      if (stackFields) element.setAttribute('data-narrow-fields', '')
      else element.removeAttribute('data-narrow-fields')
      const visibleBottom = viewport.offsetTop + viewport.height
      const keyboardInset = Math.max(0, window.innerHeight - visibleBottom)
      element.style.setProperty(
        '--record-weight-available-height',
        `${Math.max(240, viewport.height)}px`,
      )
      element.style.bottom = `${keyboardInset}px`
    }
    updateViewport()
    viewport?.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    compactViewport?.addEventListener('change', updateViewport)
    return () => {
      viewport?.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      compactViewport?.removeEventListener('change', updateViewport)
      element.style.removeProperty('--record-weight-available-height')
      element.style.removeProperty('bottom')
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
    restorePageScroll.current?.()
    restorePageScroll.current = null
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
      setError('A saved entry already uses that date. It has not been changed.')
      onDuplicateDate?.(values.date)
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
        const duplicateDate =
          result.state === 'error' && result.error.code === '23505'
        setError(
          duplicateDate
            ? 'A saved entry now uses that date. It has not been changed.'
            : 'Your weigh-in could not be saved. No successful save was confirmed; try again.',
        )
        if (duplicateDate) onDuplicateDate?.(values.date)
        setSaving(false)
        return
      }
      dialog.current?.close()
      restorePageScroll.current?.()
      restorePageScroll.current = null
      focusAfterWeightMutation(trigger.current, onSaved)
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
        tabIndex={-1}
        onKeyDown={trapDialogFocus}
        aria-labelledby="record-weight-title"
        aria-describedby="record-weight-description"
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
        className="record-weight-dialog fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-panel p-5 text-ink shadow-panel backdrop:bg-black/40"
        style={{
          maxHeight: 'min(90dvh, var(--record-weight-available-height, 90dvh))',
        }}
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
        {estimateNotice ? (
          <p
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            {estimateNotice} Review the date and weight, then save explicitly.
            Sharing is optional and off by default.
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
              compactMobile
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

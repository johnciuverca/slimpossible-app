import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import type { Participant } from '../models/participant'
import { Button } from './ui'
import { trapDialogFocus } from './dialogFocus'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { useUnsavedNavigation } from './navigationSafety'

export function ChangeTargetDialog({
  workspace,
  participant,
  reached,
  onClose,
  onSaved,
}: {
  workspace: PersonalWorkspace
  participant: Participant
  reached: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const active = useRef(true)
  const busy = useRef(false)
  const [value, setValue] = useState(String(participant.targetWeightKg))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const dirty = value !== String(participant.targetWeightKg)
  useUnsavedNavigation(saving ? 'saving' : dirty ? 'dirty' : null)
  useEffect(() => {
    active.current = true
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      active.current = false
      element?.close()
    }
  }, [])
  useEffect(() => {
    if (!dirty && !saving) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, saving])
  function close() {
    dialog.current?.close()
    if (trigger.current?.isConnected) trigger.current.focus()
    onClose()
  }
  function dismiss() {
    if (busy.current) return
    if (dirty) setDiscard(true)
    else close()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      busy.current ||
      participant.userId !== workspace.userId ||
      participant.status !== 'active' ||
      workspace.personal.state !== 'ready' ||
      workspace.contexts.state !== 'ready'
    )
      return
    const target = Number(value)
    if (
      !value.trim() ||
      !Number.isFinite(target) ||
      !Number.isFinite(participant.startingWeightKg) ||
      participant.startingWeightKg <= 0 ||
      target < 0.01 ||
      target > 9999.99 ||
      target !== Math.round(target * 100) / 100 ||
      target >= participant.startingWeightKg
    ) {
      setError(
        'Choose a positive target below your original starting weight, with no more than two decimal places.',
      )
      return
    }
    if (reached && target >= participant.targetWeightKg) {
      setError('After reaching a target, choose a lower target.')
      return
    }
    busy.current = true
    setSaving(true)
    setError('')
    if (workspace.persistence.mode === 'unavailable') {
      setError(
        'Target changes are unavailable right now. Your previous target is unchanged.',
      )
      busy.current = false
      setSaving(false)
      return
    }
    try {
      const result =
        await workspace.persistence.repositories.participants.changeOwnGroupTarget(
          participant.challengeId,
          target,
        )
      if (!active.current) return
      if (
        result.state !== 'success' ||
        result.data.challengeId !== participant.challengeId ||
        result.data.startingWeightKg !== participant.startingWeightKg ||
        result.data.targetWeightKg !== target
      ) {
        setError(
          'Your target change could not be confirmed. Your previous target is still shown. Refresh and try again; target changes may be unavailable for this group.',
        )
        busy.current = false
        setSaving(false)
        return
      }
      dialog.current?.close()
      onSaved()
    } catch {
      if (active.current) {
        setError(
          'Your target change could not be confirmed. Refresh and try again.',
        )
        busy.current = false
        setSaving(false)
      }
    }
  }
  return (
    <>
      <dialog
        ref={dialog}
        onKeyDown={trapDialogFocus}
        aria-labelledby="change-target-title"
        aria-describedby="change-target-description"
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 text-ink shadow-panel backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl sm:p-8"
      >
        <h2 id="change-target-title" className="text-2xl font-extrabold">
          Change your group target
        </h2>
        <p
          id="change-target-description"
          className="mt-3 text-sm text-ink-muted"
        >
          Your original starting weight stays {participant.startingWeightKg} kg.
          Reached targets are kept in your milestone history. Current group
          members can see your starting weight, target and shared progress.
        </p>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <label htmlFor="new-group-target" className="block font-semibold">
            New target (kg)
          </label>
          <input
            id="new-group-target"
            type="number"
            min="0.01"
            step="0.01"
            value={value}
            disabled={saving}
            aria-invalid={!!error}
            aria-describedby={error ? 'target-change-error' : undefined}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 py-2"
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
          />
          {error ? (
            <p
              id="target-change-error"
              role="alert"
              className="text-danger-800"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button className="min-h-11" type="submit" disabled={saving}>
              {saving ? 'Saving target…' : 'Save target'}
            </Button>
            <Button
              className="min-h-11"
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={dismiss}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
      {discard ? (
        <UnsavedChangesDialog
          onStay={() => setDiscard(false)}
          onDiscard={close}
        />
      ) : null}
    </>
  )
}

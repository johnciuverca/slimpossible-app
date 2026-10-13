import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import type { Participant } from '../models/participant'
import { Button } from './ui'
import { trapDialogFocus } from './dialogFocus'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { useUnsavedNavigation } from './navigationSafety'

export function ChangeStartingWeightDialog({
  workspace,
  participant,
  onClose,
  onSaved,
}: {
  workspace: PersonalWorkspace
  participant: Participant
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const active = useRef(true)
  const busy = useRef(false)
  const [value, setValue] = useState(String(participant.startingWeightKg))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const dirty = value !== String(participant.startingWeightKg)
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

    const startingWeight = Number(value)
    if (
      !value.trim() ||
      !Number.isFinite(startingWeight) ||
      startingWeight < 0.01 ||
      startingWeight > 9999.99 ||
      startingWeight !== Math.round(startingWeight * 100) / 100 ||
      startingWeight < participant.targetWeightKg
    ) {
      setError(
        'Choose a starting weight from 0.01 to 9999.99 kg, with no more than two decimal places, that is at least your current target.',
      )
      return
    }

    busy.current = true
    setSaving(true)
    setError('')
    if (workspace.persistence.mode !== 'remote') {
      setError(
        'Correcting an enrollment starting weight requires a signed-in server session. Your saved value is unchanged.',
      )
      busy.current = false
      setSaving(false)
      return
    }

    try {
      const result =
        await workspace.persistence.repositories.participants.correctOwnEnrollmentStartingWeight(
          participant.challengeId,
          startingWeight,
        )
      if (!active.current) return
      if (
        result.state !== 'success' ||
        result.data.challengeId !== participant.challengeId ||
        result.data.startingWeightKg !== startingWeight ||
        result.data.targetWeightKg !== participant.targetWeightKg
      ) {
        setError(
          'Your starting weight could not be confirmed. The previous value is still shown. Refresh and try again.',
        )
        busy.current = false
        setSaving(false)
        return
      }
      dialog.current?.close()
      if (trigger.current?.isConnected) trigger.current.focus()
      onSaved()
    } catch {
      if (active.current) {
        setError(
          'Your starting weight could not be confirmed. Refresh and try again.',
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
        aria-labelledby="starting-weight-title"
        aria-describedby="starting-weight-description"
        onCancel={(event) => {
          event.preventDefault()
          dismiss()
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 text-ink shadow-panel backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl sm:p-8"
      >
        <h2 id="starting-weight-title" className="text-2xl font-extrabold">
          Edit your starting weight
        </h2>
        <p
          id="starting-weight-description"
          className="mt-3 text-sm text-ink-muted"
        >
          Correcting this enrollment value recalculates progress against your
          current target. Your target, enrollment date, weigh-ins, sharing
          choices and reached-target history stay unchanged.
        </p>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <p>Current starting weight: {participant.startingWeightKg} kg</p>
          <label
            htmlFor="corrected-starting-weight"
            className="block font-semibold"
          >
            Correct starting weight (kg)
          </label>
          <input
            id="corrected-starting-weight"
            type="number"
            min="0.01"
            max="9999.99"
            step="0.01"
            value={value}
            disabled={saving}
            aria-invalid={!!error}
            aria-describedby={error ? 'starting-weight-error' : undefined}
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 py-2"
            onWheel={(event) => event.currentTarget.blur()}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
          />
          {error ? (
            <p
              id="starting-weight-error"
              role="alert"
              className="text-danger-800"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button className="min-h-11" type="submit" disabled={saving}>
              {saving ? 'Saving starting weight…' : 'Save starting weight'}
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

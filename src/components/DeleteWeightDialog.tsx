import { useEffect, useRef, useState } from 'react'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import type { PersonalWeighIn } from '../models/personalWeighIn'
import { formatPersonalWeight } from '../models/personalHistory'
import { useUnsavedNavigation } from './navigationSafety'
import { Button } from './ui'
import { focusAfterWeightMutation, trapDialogFocus } from './dialogFocus'

export function DeleteWeightDialog({
  workspace,
  entry,
  onClose,
  onDeleted,
}: {
  workspace: PersonalWorkspace
  entry: PersonalWeighIn
  onClose: () => void
  onDeleted: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const active = useRef(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  useUnsavedNavigation(deleting ? 'saving' : null)
  useEffect(() => {
    active.current = true
    const element = dialog.current
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    element?.showModal()
    return () => {
      active.current = false
      element?.close()
    }
  }, [])
  function close() {
    if (deleting) return
    dialog.current?.close()
    if (trigger.current?.isConnected) trigger.current.focus()
    onClose()
  }
  async function remove() {
    if (
      deleting ||
      workspace.personal.state !== 'ready' ||
      workspace.persistence.mode === 'unavailable' ||
      !workspace.personal.data.some(({ id }) => id === entry.id)
    )
      return
    setDeleting(true)
    setError('')
    try {
      const result =
        await workspace.persistence.repositories.personalWeighIns.delete(
          workspace.userId,
          entry.id,
        )
      if (!active.current) return
      if (result.state !== 'success' || !result.data) {
        setDeleting(false)
        setError(
          'Deletion could not be confirmed. Refresh or try again; no successful deletion was confirmed.',
        )
        return
      }
      dialog.current?.close()
      focusAfterWeightMutation(trigger.current, onDeleted)
    } catch {
      if (active.current) {
        setDeleting(false)
        setError('Deletion could not be confirmed. Try again.')
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      onKeyDown={trapDialogFocus}
      aria-labelledby="delete-weight-title"
      aria-describedby="delete-weight-warning"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-panel p-6 text-ink backdrop:bg-black/40"
    >
      <h2 id="delete-weight-title" className="text-xl font-bold">
        Delete weight?
      </h2>
      <p className="mt-3 font-semibold">
        {formatPersonalWeight(entry.weightKg)} recorded {entry.date}
      </p>
      <p id="delete-weight-warning" className="mt-3 text-sm text-ink-muted">
        Deleting this personal entry removes it from ALL shared groups. This
        cannot be undone.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-danger-800">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          autoFocus
          variant="secondary"
          disabled={deleting}
          onClick={close}
        >
          Cancel
        </Button>
        <Button
          disabled={deleting || workspace.personal.state !== 'ready'}
          onClick={() => void remove()}
        >
          {deleting ? 'Deleting…' : 'Delete weight'}
        </Button>
      </div>
    </dialog>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'

import type { Challenge } from '../models/challenge'
import type { ChallengeRepository } from '../data/supabase/repositories'
import { Button } from './ui'
import { trapDialogFocus } from './dialogFocus'

export function DeleteArchivedChallengeDialog({
  challenge,
  deleteArchived,
  onClose,
  onDeleted,
}: {
  challenge: Challenge
  deleteArchived: ChallengeRepository['deleteArchived']
  onClose: () => void
  onDeleted: (challenge: Challenge) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const active = useRef(true)
  const busy = useRef(false)
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  function close() {
    if (busy.current) return
    dialog.current?.close()
    if (trigger.current?.isConnected) trigger.current.focus()
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current || confirmation !== challenge.name) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const result = await deleteArchived(challenge.id)
      if (!active.current) return
      if (result.state !== 'success' || result.data !== true) {
        setError(
          result.state === 'empty'
            ? 'This challenge is no longer available to delete. Refresh the list.'
            : 'The challenge could not be deleted. No completion was confirmed; refresh and try again.',
        )
        busy.current = false
        setSaving(false)
        return
      }
      busy.current = false
      setSaving(false)
      dialog.current?.close()
      onDeleted(challenge)
    } catch {
      if (!active.current) return
      setError(
        'The challenge could not be deleted. No completion was confirmed; refresh and try again.',
      )
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      onKeyDown={trapDialogFocus}
      aria-labelledby="delete-archived-challenge-title"
      aria-describedby="delete-archived-challenge-description"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 text-ink shadow-panel backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl sm:p-8"
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="mb-5 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-100 text-xl font-bold text-red-800"
          >
            !
          </span>
          <div>
            <h2
              id="delete-archived-challenge-title"
              className="text-xl font-extrabold sm:text-2xl"
            >
              Delete this challenge permanently?
            </h2>
            <p
              id="delete-archived-challenge-description"
              className="mt-2 text-sm leading-6 text-ink-muted"
            >
              This will permanently remove{' '}
              <strong className="text-ink">{challenge.name}</strong> and its
              group history. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            <p className="font-bold">Group records will be deleted</p>
            <p className="mt-1 leading-5">
              Members, group weigh-ins, invitations, and challenge history will
              be removed.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-bold">Your personal data stays yours</p>
            <p className="mt-1 leading-5">
              Your account, profile, personal weigh-ins and private notes, and
              other challenges are preserved. This challenge’s sharing links are
              removed.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-page p-3">
          <p className="text-xs text-ink-muted">
            Challenge selected for deletion
          </p>
          <p className="mt-1 break-words text-sm font-bold">{challenge.name}</p>
          <p className="mt-1 text-xs text-ink-muted">Archived challenge</p>
        </div>

        <label
          className="mt-4 block text-sm font-semibold"
          htmlFor="delete-archived-challenge-confirmation"
        >
          Type the challenge name to confirm
        </label>
        <input
          autoComplete="off"
          className="mt-2 min-h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink"
          disabled={saving}
          id="delete-archived-challenge-confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={challenge.name}
          value={confirmation}
        />
        {error ? (
          <p className="mt-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={saving} onClick={close} variant="secondary">
            Cancel
          </Button>
          <Button
            className="bg-red-800 text-white hover:bg-red-900 focus-visible:outline-red-800"
            disabled={saving || confirmation !== challenge.name}
            type="submit"
          >
            {saving ? 'Deleting…' : 'Delete challenge'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

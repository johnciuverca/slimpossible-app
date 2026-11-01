import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, TextInput } from '../components/ui'
import { useAuth } from './useAuth'

export function ProfileEmailForm({
  email,
  onDirtyChange,
  onSavingChange,
}: {
  email: string
  onDirtyChange: (dirty: boolean) => void
  onSavingChange: (saving: boolean) => void
}) {
  const { requestEmailChange } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [pendingEmail, setPendingEmail] = useState<string>()
  const container = useRef<HTMLElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (editing)
      container.current?.querySelector<HTMLInputElement>('input')?.focus()
    else
      container.current
        ?.querySelector<HTMLButtonElement>('[aria-label="Edit email address"]')
        ?.focus()
  }, [editing])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || saving) return
    setError(undefined)
    setSaving(true)
    try {
      const requested = await requestEmailChange(draft)
      if (!mounted.current || !requested) return
      setPendingEmail(draft.trim())
      setDraft('')
      onDirtyChange(false)
      setEditing(false)
    } catch (requestError) {
      if (mounted.current)
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'We could not request the email change. Try again.',
        )
    } finally {
      if (mounted.current) {
        setSaving(false)
        onSavingChange(false)
      }
    }
  }

  return (
    <section
      ref={container}
      className="my-6 space-y-3"
      aria-label="Change account email"
    >
      {editing ? (
        <form
          aria-label="Change email address"
          aria-busy={saving}
          noValidate
          onSubmit={submit}
          className="space-y-4"
        >
          <TextInput
            autoComplete="email"
            disabled={saving}
            id="profile-new-email"
            label="New email address"
            maxLength={254}
            required
            type="email"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              onDirtyChange(true)
              setError(undefined)
            }}
          />
          <p className="text-sm text-ink-muted">
            We’ll ask Supabase to send its email confirmation. Your current
            email stays active until the change is confirmed.
          </p>
          <div className="flex gap-3">
            <Button type="submit" disabled={saving || !draft.trim()}>
              {saving ? 'Sending…' : 'Send confirmation'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setDraft('')
                onDirtyChange(false)
                setError(undefined)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger-800">
              {error}
            </p>
          ) : null}
          {saving ? <p role="status">Requesting email confirmation…</p> : null}
        </form>
      ) : (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <dl>
              <dt className="text-sm text-ink-muted">Current email</dt>
              <dd className="break-all font-semibold">{email}</dd>
            </dl>
          </div>
          <Button
            className="min-h-11 min-w-11"
            type="button"
            aria-label="Edit email address"
            title="Edit email address"
            variant="ghost"
            onClick={() => {
              setDraft('')
              setError(undefined)
              setEditing(true)
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 4 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" />
            </svg>
          </Button>
        </div>
      )}
      {pendingEmail ? (
        <p role="status" className="text-sm text-forest-800">
          Confirmation requested for {pendingEmail}. {email} remains your
          account email until Supabase confirms the change.
        </p>
      ) : null}
    </section>
  )
}

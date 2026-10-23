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
  const form = useRef<HTMLFormElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (editing) form.current?.querySelector<HTMLInputElement>('input')?.focus()
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
    <section className="my-6 space-y-3" aria-label="Change account email">
      <dl>
        <dt className="text-sm text-ink-muted">Current email</dt>
        <dd className="break-all font-semibold">{email}</dd>
      </dl>
      {editing ? (
        <form
          ref={form}
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
        <Button
          className="min-h-11"
          type="button"
          variant="secondary"
          aria-label="Change email address"
          onClick={() => {
            setDraft('')
            setError(undefined)
            setEditing(true)
          }}
        >
          Change email
        </Button>
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

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, TextInput } from '../components/ui'
import { PROFILE_NAME_MAX_LENGTH, profileNameError } from './profileName'
import { useAuth } from './useAuth'

export function ProfileNameForm({ displayName }: { displayName: string }) {
  const { saveProfileName } = useAuth()
  const [name, setName] = useState(displayName)
  const [editing, setEditing] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<string>()
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!dirty && !saving) setName(displayName)
  }, [displayName, dirty, saving])
  useEffect(() => {
    if (editing) form.current?.querySelector<HTMLInputElement>('input')?.focus()
    else
      form.current
        ?.querySelector<HTMLButtonElement>('[aria-label="Edit username"]')
        ?.focus()
  }, [editing])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !editing) return
    const invalid = profileNameError(name)
    setValidation(invalid)
    setError(undefined)
    setSaved(false)
    if (invalid) return
    setSaving(true)
    try {
      const success = await saveProfileName(name)
      if (!mounted.current || !success) return
      setName(name.trim())
      setDirty(false)
      setSaved(true)
      setEditing(false)
    } catch {
      if (mounted.current)
        setError('We could not save your username. Try again.')
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <form
      ref={form}
      aria-label="Edit username"
      aria-busy={saving}
      noValidate
      onSubmit={submit}
      className="my-6 space-y-4"
    >
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            autoComplete="nickname"
            disabled={saving}
            readOnly={!editing}
            tabIndex={editing ? 0 : -1}
            error={validation}
            id="profile-username"
            label="Username"
            maxLength={PROFILE_NAME_MAX_LENGTH}
            placeholder="name or nickname"
            required
            value={name}
            onChange={(event) => {
              if (!editing) return
              setName(event.target.value)
              setDirty(true)
              setValidation(undefined)
              setError(undefined)
              setSaved(false)
            }}
          />
        </div>
        {!editing ? (
          <Button
            className="min-h-11 min-w-11"
            type="button"
            aria-label="Edit username"
            title="Edit username"
            variant="ghost"
            onClick={() => {
              setEditing(true)
              setSaved(false)
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
        ) : null}
      </div>
      {editing ? (
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setName(displayName)
              setDirty(false)
              setValidation(undefined)
              setError(undefined)
              setSaved(false)
              setEditing(false)
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {saving ? <p role="status">Saving your username…</p> : null}
      {saved ? <p role="status">Username saved.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger-800">
          {error}
        </p>
      ) : null}
    </form>
  )
}

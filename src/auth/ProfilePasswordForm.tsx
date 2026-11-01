import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, TextInput } from '../components/ui'
import { useAuth } from './useAuth'

export function ProfilePasswordForm({
  onDirtyChange,
  onSavingChange,
}: {
  onDirtyChange: (dirty: boolean) => void
  onSavingChange: (saving: boolean) => void
}) {
  const { changePassword } = useAuth()
  const [editing, setEditing] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [nonce, setNonce] = useState('')
  const [needsNonce, setNeedsNonce] = useState(false)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
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
        ?.querySelector<HTMLButtonElement>('[aria-label="Change password"]')
        ?.focus()
  }, [editing])

  const clearDraft = () => {
    setCurrentPassword('')
    setPassword('')
    setConfirmation('')
    setNonce('')
    setNeedsNonce(false)
    setVisible({})
    setError(undefined)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || saving) return
    setError(undefined)
    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }
    if (!password) {
      setError('Enter a new password.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (confirmation !== password) {
      setError('Your passwords do not match.')
      return
    }
    if (needsNonce && !nonce.trim()) {
      setError('Enter the verification code we sent you.')
      return
    }
    if (!changePassword) {
      setError('Password changes are not available right now.')
      return
    }

    setSaving(true)
    onSavingChange(true)
    try {
      const result = await changePassword(
        currentPassword,
        password,
        needsNonce ? nonce.trim() : undefined,
      )
      if (!mounted.current || result === false) return
      if (result === 'reauthentication-required') {
        setNeedsNonce(true)
        setNonce('')
        setError(undefined)
        return
      }
      clearDraft()
      onDirtyChange(false)
      setSaved(true)
      setEditing(false)
    } catch (changeError) {
      if (mounted.current)
        setError(
          changeError instanceof Error
            ? changeError.message
            : 'We could not change your password. Try again.',
        )
    } finally {
      if (mounted.current) {
        setSaving(false)
        onSavingChange(false)
      }
    }
  }

  const passwordInput = (
    id: string,
    label: string,
    value: string,
    setValue: (value: string) => void,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <div className="relative">
      <TextInput
        autoComplete={autoComplete}
        className="pr-12"
        disabled={saving}
        id={id}
        label={label}
        required
        type={visible[id] ? 'text' : 'password'}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          onDirtyChange(true)
          setSaved(false)
          setError(undefined)
        }}
      />
      <button
        className="absolute right-2 top-9 flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`${visible[id] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        aria-pressed={visible[id] ?? false}
        disabled={saving}
        type="button"
        onClick={() =>
          setVisible((current) => ({ ...current, [id]: !current[id] }))
        }
      >
        {visible[id] ? (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.1 0 8.7 4.4 9.8 6.4a1.2 1.2 0 0 1 0 1.2 14.4 14.4 0 0 1-3.2 3.8M6.2 6.2A14.4 14.4 0 0 0 2.2 11.4a1.2 1.2 0 0 0 0 1.2C3.3 14.6 6.9 19 12 19c1.1 0 2.1-.2 3-.6" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.2 11.4C3.3 9.4 6.9 5 12 5s8.7 4.4 9.8 6.4a1.2 1.2 0 0 1 0 1.2C20.7 14.6 17.1 19 12 19s-8.7-4.4-9.8-6.4a1.2 1.2 0 0 1 0-1.2Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )

  return (
    <section
      ref={container}
      className="my-6 space-y-3"
      aria-label="Change account password"
    >
      {editing ? (
        <form
          aria-label="Change password"
          aria-busy={saving}
          noValidate
          onSubmit={submit}
          className="space-y-4"
        >
          {passwordInput(
            'profile-current-password',
            'Current password',
            currentPassword,
            setCurrentPassword,
            'current-password',
          )}
          {passwordInput(
            'profile-new-password',
            'New password',
            password,
            setPassword,
            'new-password',
          )}
          {passwordInput(
            'profile-confirm-password',
            'Confirm new password',
            confirmation,
            setConfirmation,
            'new-password',
          )}
          {needsNonce ? (
            <>
              <p className="text-sm text-ink-muted" role="status">
                Supabase requires a recent verification. Enter the code sent to
                your confirmed email address or phone.
              </p>
              <TextInput
                autoComplete="one-time-code"
                disabled={saving}
                id="profile-password-verification-code"
                inputMode="numeric"
                label="Verification code"
                required
                value={nonce}
                onChange={(event) => {
                  setNonce(event.target.value)
                  setError(undefined)
                }}
              />
            </>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating…' : 'Update password'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                clearDraft()
                onDirtyChange(false)
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
          {saving ? <p role="status">Updating your account password…</p> : null}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">Password</p>
          <Button
            aria-label="Change password"
            type="button"
            variant="secondary"
            onClick={() => {
              setEditing(true)
              setSaved(false)
            }}
          >
            Change password
          </Button>
        </div>
      )}
      {saved ? <p role="status">Password updated.</p> : null}
    </section>
  )
}

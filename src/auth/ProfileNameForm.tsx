import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, TextInput } from '../components/ui'
import { PROFILE_NAME_MAX_LENGTH, profileNameError } from './profileName'
import { useAuth } from './useAuth'

export function ProfileNameForm({ displayName }: { displayName: string }) {
  const { saveProfileName } = useAuth()
  const [name, setName] = useState(displayName)
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
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
    } catch {
      if (mounted.current)
        setError('We could not save your username. Try again.')
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <form
      aria-label="Edit username"
      aria-busy={saving}
      noValidate
      onSubmit={submit}
      className="my-6 space-y-4"
    >
      <TextInput
        autoComplete="nickname"
        disabled={saving}
        error={validation}
        id="profile-username"
        label="Username"
        maxLength={PROFILE_NAME_MAX_LENGTH}
        placeholder="name or nickname"
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setDirty(true)
          setValidation(undefined)
          setError(undefined)
          setSaved(false)
        }}
      />
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save username'}
      </Button>
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

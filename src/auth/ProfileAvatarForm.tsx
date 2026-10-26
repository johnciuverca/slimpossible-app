import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '../components/ui'
import { ProfileAvatarImage } from './ProfileAvatarImage'
import {
  PROFILE_AVATAR_SETS,
  type ProfileAvatarPresetId,
  type ProfileAvatarSetId,
} from './profileAvatar'
import { useAuth } from './useAuth'

export function ProfileAvatarForm({
  onDirtyChange,
  onSavingChange,
}: {
  onDirtyChange: (dirty: boolean) => void
  onSavingChange: (saving: boolean) => void
}) {
  const {
    chooseProfileAvatar,
    clearProfileAvatar,
    getProfileAvatar,
    saveProfileAvatar,
  } = useAuth()
  const picker = useRef<HTMLDialogElement>(null)
  const changeButton = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [set, setSet] = useState<ProfileAvatarSetId>('male')
  const [selected, setSelected] = useState<ProfileAvatarPresetId | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      const avatar = await getProfileAvatar?.()
      setSelected(avatar?.presetId ?? null)
      setPhotoUrl(avatar?.signedUrl)
      setError(undefined)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We could not load your profile picture. Try again.',
      )
    }
  }, [getProfileAvatar])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 4 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refresh])
  useEffect(() => {
    const element = picker.current
    if (pickerOpen) element?.showModal()
    else if (element?.open) element.close()
    return () => {
      if (element?.open) element.close()
    }
  }, [pickerOpen])

  function closePicker() {
    setPickerOpen(false)
    window.setTimeout(() => changeButton.current?.focus(), 0)
  }

  async function save(task: () => Promise<boolean>, success: string) {
    if (busy) return
    setBusy(true)
    onDirtyChange(true)
    onSavingChange(true)
    setError(undefined)
    setNotice(undefined)
    try {
      const completed = await task()
      if (!completed) {
        setError('Your account changed. Reopen Profile and try again.')
        return
      }
      await refresh()
      window.dispatchEvent(new Event('profile-avatar-updated'))
      setNotice(success)
      closePicker()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We could not update your avatar. Try again.',
      )
    } finally {
      setBusy(false)
      onDirtyChange(false)
      onSavingChange(false)
    }
  }

  return (
    <section aria-labelledby="profile-avatar-title" className="mt-4 space-y-3">
      <h3 id="profile-avatar-title" className="font-semibold">
        Profile picture
      </h3>
      <div className="flex items-center justify-between gap-4">
        <div
          className="account-avatar h-24 w-24 shrink-0 overflow-hidden text-4xl"
          aria-label={
            photoUrl
              ? 'Current uploaded profile picture'
              : selected
                ? `Selected avatar ${selected}`
                : 'Default profile picture'
          }
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : selected ? (
            <ProfileAvatarImage
              avatarId={selected}
              className="h-full w-full rounded-full"
            />
          ) : (
            <span aria-hidden="true">🙂</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <button
            type="button"
            ref={changeButton}
            aria-label="Change profile picture"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest-100 px-4 py-2 text-sm font-semibold text-forest-800 transition hover:bg-forest-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              setError(undefined)
              setNotice(undefined)
              setPickerOpen(true)
            }}
          >
            Change picture
          </button>
          {(photoUrl || selected) && clearProfileAvatar ? (
            <Button
              aria-label="Remove profile picture"
              className="min-h-11 min-w-11"
              disabled={busy}
              onClick={() =>
                void save(clearProfileAvatar, 'Profile picture removed.')
              }
              title="Remove profile picture"
              variant="ghost"
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
                <path d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
              </svg>
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-ink-muted">
          {notice}
        </p>
      ) : null}
      <dialog
        ref={picker}
        aria-labelledby="profile-avatar-picker-title"
        className="m-auto max-h-[min(90dvh,48rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-line bg-panel p-6 text-ink shadow-panel backdrop:bg-black/60"
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          closePicker()
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onClose={() => changeButton.current?.focus()}
      >
        <div className="flex items-start justify-between gap-4">
          <h4 id="profile-avatar-picker-title" className="text-xl font-bold">
            Choose a profile picture
          </h4>
          <Button onClick={closePicker} variant="ghost">
            Close
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold">
            Upload photo
            <input
              aria-label="Upload profile picture"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file && saveProfileAvatar)
                  void save(
                    () => saveProfileAvatar(file),
                    'Profile picture updated.',
                  )
              }}
            />
          </label>
          <p className="text-xs text-ink-muted">JPG, PNG, or WebP</p>
        </div>
        <div role="tablist" aria-label="Avatar set" className="mt-5 flex gap-2">
          {(['male', 'female'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              role="tab"
              aria-selected={set === choice}
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold capitalize focus-visible:outline-2 focus-visible:outline-forest-700"
              onClick={() => setSet(choice)}
            >
              {choice === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Choose any avatar from either set. Both sets are available to
          everyone.
        </p>
        <div
          role="tabpanel"
          aria-label={`${set === 'male' ? 'Male' : 'Female'} avatars`}
          className="mt-3 grid grid-cols-5 gap-2"
        >
          {PROFILE_AVATAR_SETS[set].map(({ id, number }) => (
            <button
              key={id}
              type="button"
              aria-label={`Choose ${set} avatar ${number}`}
              aria-pressed={selected === id}
              disabled={busy}
              className={`aspect-square overflow-hidden rounded-xl border p-0 focus-visible:outline-2 focus-visible:outline-forest-700 ${selected === id ? 'border-forest-700 ring-2 ring-forest-700' : 'border-line'}`}
              onClick={() =>
                chooseProfileAvatar &&
                void save(() => chooseProfileAvatar(id), 'Avatar updated.')
              }
            >
              <ProfileAvatarImage
                avatarId={id}
                className="h-full w-full rounded-[inherit]"
              />
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger-800">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-sm text-ink-muted">
            {notice}
          </p>
        ) : null}
      </dialog>
    </section>
  )
}

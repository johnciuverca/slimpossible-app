import { useCallback, useEffect, useState } from 'react'

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
  const [set, setSet] = useState<ProfileAvatarSetId>('male')
  const [selected, setSelected] = useState<ProfileAvatarPresetId | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const refresh = useCallback(async () => {
    const avatar = await getProfileAvatar?.()
    setSelected(avatar?.presetId ?? null)
    setPhotoUrl(avatar?.signedUrl)
  }, [getProfileAvatar])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 4 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function save(task: () => Promise<boolean>, success: string) {
    if (busy) return
    setBusy(true)
    onDirtyChange(true)
    onSavingChange(true)
    setError(undefined)
    setNotice(undefined)
    try {
      const completed = await task()
      if (!completed) return
      await refresh()
      window.dispatchEvent(new Event('profile-avatar-updated'))
      setNotice(success)
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
    <section aria-labelledby="profile-avatar-title" className="my-6 space-y-3">
      <h3 id="profile-avatar-title" className="font-semibold">
        Profile picture
      </h3>
      <div className="flex items-center gap-3">
        <div
          className="account-avatar"
          aria-label={
            photoUrl
              ? 'Current uploaded profile picture'
              : selected
                ? `Selected avatar ${selected}`
                : 'No profile picture selected'
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
            '🙂'
          )}
        </div>
        <div className="flex flex-wrap gap-2">
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
          {(photoUrl || selected) && clearProfileAvatar ? (
            <Button
              disabled={busy}
              onClick={() =>
                void save(clearProfileAvatar, 'Profile picture removed.')
              }
              variant="ghost"
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div role="tablist" aria-label="Avatar set" className="flex gap-2">
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
      <p className="text-xs text-ink-muted">
        Choose any avatar from either set. Both sets are available to everyone.
      </p>
      <div
        role="tabpanel"
        aria-label={`${set === 'male' ? 'Male' : 'Female'} avatars`}
        className="grid grid-cols-5 gap-2"
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
        <p role="alert" className="text-sm text-danger-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-ink-muted">
          {notice}
        </p>
      ) : null}
    </section>
  )
}

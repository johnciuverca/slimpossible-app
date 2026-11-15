import { ProfileAvatarImage } from '../auth/ProfileAvatarImage'
import type { ProfileAvatarPresetId } from '../auth/profileAvatar'

export function GroupParticipantAvatar({
  avatarPresetId,
  displayName,
}: {
  avatarPresetId?: ProfileAvatarPresetId | null
  displayName: string
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-300 bg-stone-100 text-sm font-semibold text-slate-700"
      data-avatar-preset={avatarPresetId ?? 'default'}
    >
      {avatarPresetId ? (
        <ProfileAvatarImage
          avatarId={avatarPresetId}
          className="h-full w-full rounded-full"
        />
      ) : (
        <span>{displayName.trim().charAt(0).toLocaleUpperCase() || '?'}</span>
      )}
    </span>
  )
}

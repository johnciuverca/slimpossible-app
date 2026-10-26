import type { CSSProperties } from 'react'

import {
  profileAvatarSpriteStyle,
  type ProfileAvatarPresetId,
} from './profileAvatar'

export function ProfileAvatarImage({
  avatarId,
  className = '',
}: {
  avatarId: ProfileAvatarPresetId
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-no-repeat ${className}`}
      style={profileAvatarSpriteStyle(avatarId) as CSSProperties}
    />
  )
}

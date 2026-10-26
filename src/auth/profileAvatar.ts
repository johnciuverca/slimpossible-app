export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_AVATAR_MAX_DIMENSION = 2048

export type ProfileAvatarFileType = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  extension: 'jpg' | 'png' | 'webp'
}

export type ProfileAvatarPresetId = `male-${string}` | `female-${string}`
export type ProfileAvatarSetId = 'male' | 'female'
export type ProfileAvatar =
  | { id: ProfileAvatarPresetId; kind: 'preset' }
  | { kind: 'photo'; signedUrl: string }

export const PROFILE_AVATAR_SETS: Record<
  ProfileAvatarSetId,
  Array<{ id: ProfileAvatarPresetId; number: number }>
> = {
  male: Array.from({ length: 15 }, (_, index) => ({
    id: `male-${String(index + 1).padStart(2, '0')}` as ProfileAvatarPresetId,
    number: index + 1,
  })),
  female: Array.from({ length: 15 }, (_, index) => ({
    id: `female-${String(index + 1).padStart(2, '0')}` as ProfileAvatarPresetId,
    number: index + 1,
  })),
}

export function isProfileAvatarPresetId(
  value: string | null,
): value is ProfileAvatarPresetId {
  return value !== null && /^(male|female)-(0[1-9]|1[0-5])$/.test(value)
}

function sniffProfileAvatarType(
  bytes: Uint8Array,
): ProfileAvatarFileType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { contentType: 'image/jpeg', extension: 'jpg' }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return { contentType: 'image/png', extension: 'png' }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return { contentType: 'image/webp', extension: 'webp' }
  return null
}

export async function validateProfileAvatarFile(
  file: File,
): Promise<ProfileAvatarFileType> {
  if (!file.size || file.size > PROFILE_AVATAR_MAX_BYTES)
    throw new Error('Choose an image smaller than 2 MB.')

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const type = sniffProfileAvatarType(header)
  if (!type || (file.type && file.type !== type.contentType))
    throw new Error('Choose a valid JPEG, PNG, or WebP image.')

  if (typeof createImageBitmap !== 'function')
    throw new Error('This browser cannot verify the selected image.')

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width > PROFILE_AVATAR_MAX_DIMENSION ||
      bitmap.height > PROFILE_AVATAR_MAX_DIMENSION
    )
      throw new Error(
        'Image dimensions must be 2048 by 2048 pixels or smaller.',
      )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Image dimensions'))
      throw error
    throw new Error('The selected file is not a readable image.')
  } finally {
    bitmap?.close()
  }

  return type
}

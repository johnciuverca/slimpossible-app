import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isProfileAvatarPresetId,
  PROFILE_AVATAR_SETS,
  profileAvatarSpriteStyle,
  validateProfileAvatarFile,
} from './profileAvatar'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('profile avatar presets', () => {
  it('provides 15 choices in each set, independent of account attributes', () => {
    expect(PROFILE_AVATAR_SETS.male).toHaveLength(15)
    expect(PROFILE_AVATAR_SETS.female).toHaveLength(15)
    expect(isProfileAvatarPresetId('male-15')).toBe(true)
    expect(isProfileAvatarPresetId('female-01')).toBe(true)
    expect(isProfileAvatarPresetId('female-16')).toBe(false)
    expect(isProfileAvatarPresetId('other-01')).toBe(false)
  })

  it('maps every built-in choice to its own crop in the approved contact sheets', () => {
    const maleStyles = PROFILE_AVATAR_SETS.male.map(({ id }) =>
      profileAvatarSpriteStyle(id),
    )
    const femaleStyles = PROFILE_AVATAR_SETS.female.map(({ id }) =>
      profileAvatarSpriteStyle(id),
    )
    expect(
      new Set(maleStyles.map((style) => style.backgroundPosition)).size,
    ).toBe(15)
    expect(
      new Set(femaleStyles.map((style) => style.backgroundPosition)).size,
    ).toBe(15)
    expect(maleStyles[0].backgroundImage).toContain(
      'male-challenge-avatars.png',
    )
    expect(femaleStyles[14].backgroundImage).toContain(
      'female-challenge-avatars.png',
    )
    expect(maleStyles[0].backgroundSize).toBe('529% auto')
  })
})

describe('validateProfileAvatarFile', () => {
  it('accepts a JPEG with a matching signature and bounded decoded dimensions', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 256, height: 256, close: vi.fn() })),
    )
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0x00])],
      'avatar.jpg',
      {
        type: 'image/jpeg',
      },
    )
    await expect(validateProfileAvatarFile(file)).resolves.toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    })
  })

  it('rejects unsupported, mismatched, oversized, and oversized-dimension files', async () => {
    const validHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    await expect(
      validateProfileAvatarFile(
        new File(['x'], 'x.svg', { type: 'image/svg+xml' }),
      ),
    ).rejects.toThrow('Choose a valid JPEG, PNG, or WebP image.')

    await expect(
      validateProfileAvatarFile(
        new File([new Uint8Array(validHeader)], 'x.png', {
          type: 'image/jpeg',
        }),
      ),
    ).rejects.toThrow('Choose a valid JPEG, PNG, or WebP image.')

    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'x.png', {
      type: 'image/png',
    })
    await expect(validateProfileAvatarFile(oversized)).rejects.toThrow(
      'smaller than 2 MB',
    )

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 2049, height: 100, close: vi.fn() })),
    )
    const image = new File([new Uint8Array(validHeader)], 'x.png', {
      type: 'image/png',
    })
    await expect(validateProfileAvatarFile(image)).rejects.toThrow(
      '2048 by 2048',
    )
  })
})

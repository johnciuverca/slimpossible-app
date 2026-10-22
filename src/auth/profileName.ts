export const PROFILE_NAME_MAX_LENGTH = 80

export function normalizeProfileName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.trim()
  return name && name.length <= PROFILE_NAME_MAX_LENGTH ? name : undefined
}

export function safeProfileDisplayName(
  value: unknown,
  email: string,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const name = value.trim()
  if (!name || name.toLowerCase() === email.trim().toLowerCase()) {
    return undefined
  }
  return name
}

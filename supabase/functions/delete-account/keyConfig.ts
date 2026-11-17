/** Parse one named API key without exposing its value in errors or logs. */
export function readNamedKey(
  keyMapJson: string | undefined,
  keyName = 'default',
): string | null {
  if (!keyMapJson) return null

  try {
    const parsed: unknown = JSON.parse(keyMapJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }

    const key = (parsed as Record<string, unknown>)[keyName]
    return typeof key === 'string' && key.trim() ? key : null
  } catch {
    return null
  }
}

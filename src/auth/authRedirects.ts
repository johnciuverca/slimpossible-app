const resetPasswordPath = '/reset-password'
const verificationPath = '/login'

type BrowserLocation = Pick<Location, 'hash' | 'pathname' | 'search'>

function sameOriginUrl(path: string, origin: string) {
  const base = new URL(origin)
  const destination = new URL(path, base)

  if (destination.origin !== base.origin) {
    throw new Error('Authentication redirects must stay on the current origin.')
  }

  return destination.toString()
}

export function getRecoveryRedirectUrl(origin = window.location.origin) {
  return sameOriginUrl(resetPasswordPath, origin)
}

export function getVerificationRedirectUrl(origin = window.location.origin) {
  return sameOriginUrl(verificationPath, origin)
}

export function isRecoveryCallback(location: BrowserLocation) {
  if (location.pathname !== resetPasswordPath) return false

  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))

  return query.get('type') === 'recovery' || hash.get('type') === 'recovery'
}

export function safeInternalPath(locationState: unknown) {
  const from = (
    locationState as {
      from?: { hash?: string; pathname?: string; search?: string }
    } | null
  )?.from
  const pathname = from?.pathname

  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return '/today'
  }

  return `${pathname}${from.search ?? ''}${from.hash ?? ''}`
}

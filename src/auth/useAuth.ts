import { useContext } from 'react'

import { AuthContext } from './context'

const signedOutFallback = {
  error: null,
  status: 'signed-out' as const,
  user: null,
}
const optionalAuthFallback = { state: signedOutFallback }

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}

export function useOptionalAuth() {
  return useContext(AuthContext) ?? optionalAuthFallback
}

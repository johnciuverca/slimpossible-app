import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext, type AuthProviderProps, type AuthState } from './context'
import { createSupabaseAuthGateway } from './supabaseAuth'

export type { AuthState, AuthUser } from './context'

const sessionCheckDelay = 150
const loadingState: AuthState = {
  error: null,
  status: 'loading',
  user: null,
}
const signedOutState: AuthState = {
  error: null,
  status: 'signed-out',
  user: null,
}

function checkLocalSession(setState: (state: AuthState) => void) {
  return window.setTimeout(() => setState(signedOutState), sessionCheckDelay)
}

export function AuthProvider({
  authGateway = createSupabaseAuthGateway(),
  children,
  initialState,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState ?? loadingState)

  useEffect(() => {
    if (initialState) {
      return
    }

    const timerId = checkLocalSession(setState)
    return () => window.clearTimeout(timerId)
  }, [initialState])

  function retrySession() {
    setState(loadingState)
    checkLocalSession(setState)
  }

  function signOut() {
    setState(signedOutState)
  }

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState(loadingState)
      try {
        const user = await authGateway.signIn(email.trim(), password)
        setState({ error: null, status: 'signed-in', user })
      } catch (error) {
        setState({
          error: error instanceof Error ? error.message : 'Unable to sign in.',
          status: 'error',
          user: null,
        })
      }
    },
    [authGateway],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setState(loadingState)
      try {
        const result = await authGateway.signUp(name, email.trim(), password)
        setState(
          result.needsVerification || !result.user
            ? { error: null, status: 'verification-pending', user: null }
            : { error: null, status: 'signed-in', user: result.user },
        )
      } catch (error) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Unable to create an account.',
          status: 'error',
          user: null,
        })
      }
    },
    [authGateway],
  )

  const value = useMemo(
    () => ({ retrySession, signIn, signOut, signUp, state }),
    [signIn, signUp, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

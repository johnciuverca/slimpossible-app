import { useCallback, useEffect, useMemo, useState } from 'react'

import { AuthContext, type AuthProviderProps, type AuthState } from './context'
import { createSupabaseAuthGateway } from './supabaseAuth'

export type { AuthState, AuthUser } from './context'

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

export function AuthProvider({
  authGateway = createSupabaseAuthGateway(),
  children,
  initialState,
}: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState ?? loadingState)

  const restoreSession = useCallback(() => {
    const timerId = window.setTimeout(() => {
      void authGateway
        .getSession()
        .then((user) =>
          setState(
            user ? { error: null, status: 'signed-in', user } : signedOutState,
          ),
        )
        .catch((error) =>
          setState({
            error:
              error instanceof Error
                ? error.message
                : 'We could not restore your session. Try again.',
            status: 'error',
            user: null,
          }),
        )
    }, 150)
    return () => window.clearTimeout(timerId)
  }, [authGateway])

  useEffect(() => {
    if (initialState) {
      return
    }

    let active = true
    const cancelRestore = restoreSession()
    const unsubscribe = authGateway.onAuthStateChange((user) => {
      if (active) {
        setState(
          user ? { error: null, status: 'signed-in', user } : signedOutState,
        )
      }
    })
    return () => {
      active = false
      cancelRestore()
      unsubscribe()
    }
  }, [authGateway, initialState, restoreSession])

  const retrySession = useCallback(() => {
    setState(loadingState)
    return restoreSession()
  }, [restoreSession])

  const signOut = useCallback(async () => {
    setState(signedOutState)
    try {
      await authGateway.signOut()
    } catch (error) {
      setState({
        error:
          error instanceof Error ? error.message : 'We could not sign you out.',
        status: 'error',
        user: null,
      })
    }
  }, [authGateway])

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
    [retrySession, signIn, signOut, signUp, state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

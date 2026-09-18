import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  authGateway: providedAuthGateway,
  children,
  initialState,
}: AuthProviderProps) {
  const [fallbackAuthGateway] = useState(createSupabaseAuthGateway)
  const authGateway = providedAuthGateway ?? fallbackAuthGateway
  const [state, setState] = useState<AuthState>(initialState ?? loadingState)
  const operationRef = useRef(0)

  const restoreSession = useCallback(() => {
    const operation = ++operationRef.current
    const timerId = window.setTimeout(() => {
      void authGateway
        .getSession()
        .then(async (user) => {
          if (user) await authGateway.ensureProfile(user)
          if (operationRef.current !== operation) return
          setState(
            user ? { error: null, status: 'signed-in', user } : signedOutState,
          )
        })
        .catch(
          (error) =>
            operationRef.current === operation &&
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
        if (!user) {
          ++operationRef.current
          setState(signedOutState)
          return
        }
        const operation = ++operationRef.current
        void authGateway
          .ensureProfile(user)
          .then(() => {
            if (active && operationRef.current === operation)
              setState({ error: null, status: 'signed-in', user })
          })
          .catch((error) => {
            if (active && operationRef.current === operation) {
              setState({
                error:
                  error instanceof Error
                    ? error.message
                    : 'We could not initialize your profile.',
                status: 'error',
                user: null,
              })
            }
          })
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
    ++operationRef.current
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
      const operation = ++operationRef.current
      setState(loadingState)
      try {
        const user = await authGateway.signIn(email.trim(), password)
        await authGateway.ensureProfile(user)
        if (operationRef.current !== operation) return
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
      const operation = ++operationRef.current
      setState(loadingState)
      try {
        const result = await authGateway.signUp(name, email.trim(), password)
        if (result.user && !result.needsVerification)
          await authGateway.ensureProfile(result.user)
        if (operationRef.current !== operation) return
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

import { useEffect, useMemo, useState } from 'react'

import { AuthContext, type AuthProviderProps, type AuthState } from './context'

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

export function AuthProvider({ children, initialState }: AuthProviderProps) {
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

  function signIn(email: string, password: string) {
    setState(loadingState)

    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (!email.trim() || !password) {
          setState({
            error: 'Email and password are required for local sign-in.',
            status: 'error',
            user: null,
          })
          resolve()
          return
        }

        setState({
          error: null,
          status: 'signed-in',
          user: { email: email.trim() },
        })
        resolve()
      }, sessionCheckDelay)
    })
  }

  const value = useMemo(
    () => ({ retrySession, signIn, signOut, state }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

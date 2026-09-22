import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getRecoveryRedirectUrl, isRecoveryCallback } from './authRedirects'
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

function userKey(user: { email: string; id?: string }) {
  return user.id ?? user.email
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AuthProvider({
  authGateway: providedAuthGateway,
  children,
  initialState,
}: AuthProviderProps) {
  const [fallbackAuthGateway] = useState(createSupabaseAuthGateway)
  const authGateway = providedAuthGateway ?? fallbackAuthGateway
  const [state, setState] = useState<AuthState>(initialState ?? loadingState)
  const operationGeneration = useRef(0)
  const currentUserKey = useRef(
    initialState?.status === 'signed-in' ||
      initialState?.status === 'recovery-ready'
      ? userKey(initialState.user)
      : null,
  )
  const recoveryIntent = useRef(
    initialState?.status === 'recovery-ready' ||
      (!initialState && isRecoveryCallback(window.location)),
  )
  const blockedUserKey = useRef<string | null>(null)
  const initializedProfiles = useRef(new Set<string>())
  const pendingProfiles = useRef(new Map<string, Promise<void>>())

  const ensureProfileOnce = useCallback(
    (
      user: NonNullable<Extract<AuthState, { status: 'signed-in' }>['user']>,
    ) => {
      const key = userKey(user)
      if (initializedProfiles.current.has(key)) return Promise.resolve()
      const pending = pendingProfiles.current.get(key)
      if (pending) return pending

      const next = authGateway.ensureProfile(user).then(() => {
        initializedProfiles.current.add(key)
      })
      pendingProfiles.current.set(key, next)
      void next
        .finally(() => {
          if (pendingProfiles.current.get(key) === next) {
            pendingProfiles.current.delete(key)
          }
        })
        .catch(() => undefined)
      return next
    },
    [authGateway],
  )

  const applySignedOut = useCallback((generation: number) => {
    if (generation !== operationGeneration.current) return
    currentUserKey.current = null
    blockedUserKey.current = null
    setState(signedOutState)
  }, [])

  const applySignedIn = useCallback(
    (
      user: NonNullable<Extract<AuthState, { status: 'signed-in' }>['user']>,
      generation: number,
    ) => {
      if (
        generation !== operationGeneration.current ||
        blockedUserKey.current === userKey(user)
      ) {
        return
      }

      const key = userKey(user)
      currentUserKey.current = key
      setState((currentState) => {
        if (
          currentState.status === 'signed-in' &&
          currentState.user.id === user.id &&
          currentState.user.email === user.email &&
          currentState.user.displayName === user.displayName
        ) {
          return currentState
        }
        return { error: null, status: 'signed-in', user }
      })

      // Supabase requires auth callbacks to return without starting another
      // Supabase request. Profile initialization is deliberately deferred.
      window.setTimeout(() => {
        if (
          generation !== operationGeneration.current ||
          currentUserKey.current !== key ||
          blockedUserKey.current === key
        ) {
          return
        }

        void ensureProfileOnce(user).catch((error) => {
          if (
            generation === operationGeneration.current &&
            currentUserKey.current === key
          ) {
            setState({
              error: errorMessage(
                error,
                'We could not initialize your profile. Try again.',
              ),
              status: 'error',
              user: null,
            })
          }
        })
      }, 0)
    },
    [ensureProfileOnce],
  )

  const applyRecoveryReady = useCallback(
    (
      user: NonNullable<
        Extract<AuthState, { status: 'recovery-ready' }>['user']
      >,
      generation: number,
    ) => {
      if (
        generation !== operationGeneration.current ||
        blockedUserKey.current === userKey(user)
      ) {
        return
      }

      recoveryIntent.current = true
      currentUserKey.current = userKey(user)
      setState({ error: null, status: 'recovery-ready', user })
    },
    [],
  )

  const restoreSession = useCallback(() => {
    const generation = operationGeneration.current
    let cancelled = false
    const timerId = window.setTimeout(() => {
      void authGateway
        .getSession()
        .then((user) => {
          if (cancelled || generation !== operationGeneration.current) return

          // A callback may have delivered a newer authenticated session while
          // getSession was resolving. Do not let an older empty result sign it
          // back out.
          if (!user && currentUserKey.current) return
          if (user) {
            if (recoveryIntent.current) {
              applyRecoveryReady(user, generation)
            } else {
              applySignedIn(user, generation)
            }
          } else if (recoveryIntent.current) {
            setState({ error: null, status: 'recovery-invalid', user: null })
          } else {
            applySignedOut(generation)
          }
        })
        .catch((error) => {
          if (
            cancelled ||
            generation !== operationGeneration.current ||
            currentUserKey.current
          ) {
            return
          }
          setState({
            error: errorMessage(
              error,
              'We could not restore your session. Try again.',
            ),
            status: 'error',
            user: null,
          })
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [applyRecoveryReady, applySignedIn, applySignedOut, authGateway])

  useEffect(() => {
    if (initialState) return

    let active = true
    const unsubscribe = authGateway.onAuthStateChange((user, event) => {
      if (!active) return

      const generation = operationGeneration.current
      if (event === 'PASSWORD_RECOVERY') {
        recoveryIntent.current = true
        if (user) {
          applyRecoveryReady(user, generation)
        } else {
          setState({ error: null, status: 'recovery-invalid', user: null })
        }
        return
      }
      if (!user) {
        if (recoveryIntent.current) {
          setState({ error: null, status: 'recovery-invalid', user: null })
          return
        }
        applySignedOut(generation)
        return
      }

      // This callback only updates React state. applySignedIn defers profile
      // I/O until after the provider callback has returned to Supabase.
      if (recoveryIntent.current) {
        applyRecoveryReady(user, generation)
      } else {
        applySignedIn(user, generation)
      }
    })
    const cancelRestore = restoreSession()

    return () => {
      active = false
      operationGeneration.current += 1
      cancelRestore()
      unsubscribe()
    }
  }, [
    applyRecoveryReady,
    applySignedIn,
    applySignedOut,
    authGateway,
    initialState,
    restoreSession,
  ])

  const retrySession = useCallback(() => {
    operationGeneration.current += 1
    blockedUserKey.current = null
    currentUserKey.current = null
    recoveryIntent.current = isRecoveryCallback(window.location)
    setState(loadingState)
    restoreSession()
  }, [restoreSession])

  const signOut = useCallback(async () => {
    const generation = operationGeneration.current + 1
    operationGeneration.current = generation
    recoveryIntent.current = false
    blockedUserKey.current = currentUserKey.current
    currentUserKey.current = null
    setState(signedOutState)

    try {
      await authGateway.signOut()
      if (generation === operationGeneration.current) {
        blockedUserKey.current = null
      }
    } catch (error) {
      if (generation !== operationGeneration.current) return
      blockedUserKey.current = null
      setState({
        error: errorMessage(error, 'We could not sign you out.'),
        status: 'error',
        user: null,
      })
    }
  }, [authGateway])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const generation = operationGeneration.current + 1
      operationGeneration.current = generation
      recoveryIntent.current = false
      blockedUserKey.current = null
      currentUserKey.current = null
      setState(loadingState)

      try {
        const user = await authGateway.signIn(email.trim(), password)
        if (generation === operationGeneration.current) {
          applySignedIn(user, generation)
        }
      } catch (error) {
        if (generation !== operationGeneration.current) return
        setState({
          error: errorMessage(error, 'Unable to sign in.'),
          status: 'error',
          user: null,
        })
      }
    },
    [applySignedIn, authGateway],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const generation = operationGeneration.current + 1
      operationGeneration.current = generation
      recoveryIntent.current = false
      blockedUserKey.current = null
      currentUserKey.current = null
      setState(loadingState)

      try {
        const result = await authGateway.signUp(name, email.trim(), password)
        if (generation !== operationGeneration.current) return

        if (result.needsVerification || !result.user) {
          setState({
            error: null,
            status: 'verification-pending',
            user: null,
          })
          return
        }

        applySignedIn(result.user, generation)
      } catch (error) {
        if (generation !== operationGeneration.current) return
        setState({
          error: errorMessage(error, 'Unable to create an account.'),
          status: 'error',
          user: null,
        })
      }
    },
    [applySignedIn, authGateway],
  )

  const requestPasswordRecovery = useCallback(
    async (email: string) => {
      const generation = operationGeneration.current + 1
      operationGeneration.current = generation
      recoveryIntent.current = false
      blockedUserKey.current = null
      currentUserKey.current = null
      setState(loadingState)

      try {
        await authGateway.requestPasswordRecovery(
          email.trim(),
          getRecoveryRedirectUrl(),
        )
        if (generation === operationGeneration.current) {
          setState({ error: null, status: 'recovery-requested', user: null })
        }
      } catch (error) {
        if (generation !== operationGeneration.current) return
        setState({
          error: errorMessage(
            error,
            'We could not request a recovery link. Try again.',
          ),
          status: 'error',
          user: null,
        })
      }
    },
    [authGateway],
  )

  const resetPassword = useCallback(
    async (password: string) => {
      if (state.status !== 'recovery-ready') {
        setState({ error: null, status: 'recovery-invalid', user: null })
        return false
      }

      const generation = operationGeneration.current + 1
      operationGeneration.current = generation

      try {
        await authGateway.resetPassword(password)
        recoveryIntent.current = false
        await authGateway.signOut()
        if (generation !== operationGeneration.current) return false
        currentUserKey.current = null
        blockedUserKey.current = null
        setState(signedOutState)
        return true
      } catch (error) {
        if (generation !== operationGeneration.current) return false
        setState({
          error: errorMessage(
            error,
            'We could not update your password. Request a new recovery link.',
          ),
          status: 'error',
          user: null,
        })
        return false
      }
    },
    [authGateway, state.status],
  )

  const value = useMemo(
    () => ({
      requestPasswordRecovery,
      resetPassword,
      retrySession,
      signIn,
      signOut,
      signUp,
      state,
    }),
    [
      requestPasswordRecovery,
      resetPassword,
      retrySession,
      signIn,
      signOut,
      signUp,
      state,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

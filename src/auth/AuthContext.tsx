import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getRecoveryRedirectUrl, isRecoveryCallback } from './authRedirects'
import { AuthContext, type AuthProviderProps, type AuthState } from './context'
import { createSupabaseAuthGateway } from './supabaseAuth'
import { profileNameError } from './profileName'

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
  const accountGeneration = useRef(0)
  const profileVersions = useRef(new Map<string, number>())
  const profileSave = useRef(0)
  const pendingProfileSaves = useRef(new Set<string>())
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
  const initializedProfiles = useRef(new Map<string, string | undefined>())
  const pendingProfiles = useRef(new Map<string, Promise<string | undefined>>())

  const ensureProfileOnce = useCallback(
    (
      user: NonNullable<Extract<AuthState, { status: 'signed-in' }>['user']>,
    ) => {
      const key = userKey(user)
      if (initializedProfiles.current.has(key)) {
        return Promise.resolve(initializedProfiles.current.get(key))
      }
      const pending = pendingProfiles.current.get(key)
      if (pending) return pending

      const version = profileVersions.current.get(key) ?? 0
      const account = accountGeneration.current
      const generation = operationGeneration.current
      const next = authGateway.ensureProfile(user).then((displayName) => {
        if (
          account !== accountGeneration.current ||
          generation !== operationGeneration.current ||
          version !== (profileVersions.current.get(key) ?? 0)
        )
          return initializedProfiles.current.get(key)
        initializedProfiles.current.set(key, displayName)
        return displayName
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
    accountGeneration.current += 1
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
      if (currentUserKey.current !== key) {
        accountGeneration.current += 1
        initializedProfiles.current.delete(key)
        pendingProfiles.current.delete(key)
      }
      const account = accountGeneration.current
      currentUserKey.current = key
      const profileVersion = profileVersions.current.get(key) ?? 0
      const nextUser = initializedProfiles.current.has(key)
        ? {
            ...user,
            displayName:
              initializedProfiles.current.get(key) ?? user.displayName,
          }
        : user
      setState((currentState) => {
        if (
          currentState.status === 'signed-in' &&
          currentState.user.id === user.id &&
          currentState.user.email === user.email &&
          currentState.user.displayName === nextUser.displayName
        ) {
          return currentState
        }
        return { error: null, status: 'signed-in', user: nextUser }
      })

      // Supabase requires auth callbacks to return without starting another
      // Supabase request. Profile initialization is deliberately deferred.
      window.setTimeout(() => {
        if (
          account !== accountGeneration.current ||
          generation !== operationGeneration.current ||
          currentUserKey.current !== key ||
          blockedUserKey.current === key
        ) {
          return
        }

        void ensureProfileOnce(user)
          .then((displayName) => {
            if (
              account !== accountGeneration.current ||
              generation !== operationGeneration.current ||
              currentUserKey.current !== key
            ) {
              return
            }
            setState((current) => {
              if (
                current.status !== 'signed-in' ||
                userKey(current.user) !== key
              ) {
                return current
              }
              const nextName =
                (profileVersions.current.get(key) ?? 0) !== profileVersion
                  ? initializedProfiles.current.get(key) ||
                    current.user.displayName
                  : displayName || current.user.displayName
              if (
                nextName === current.user.displayName &&
                !current.profileError
              ) {
                return current
              }
              return {
                error: null,
                status: 'signed-in',
                user: { ...current.user, displayName: nextName },
              }
            })
          })
          .catch(() => {
            if (
              account === accountGeneration.current &&
              generation === operationGeneration.current &&
              currentUserKey.current === key &&
              (profileVersions.current.get(key) ?? 0) === profileVersion
            ) {
              setState((current) =>
                current.status === 'signed-in' && userKey(current.user) === key
                  ? {
                      ...current,
                      profileError:
                        'Your profile name could not be saved. You are still signed in.',
                    }
                  : current,
              )
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

  const saveProfileName = useCallback(
    async (name: string) => {
      const invalid = profileNameError(name)
      if (invalid) throw new Error(invalid)
      if (
        state.status !== 'signed-in' ||
        !state.user.id ||
        currentUserKey.current !== userKey(state.user)
      )
        throw new Error('Sign in again to edit your username.')
      const user = state.user
      const key = userKey(user)
      if (pendingProfileSaves.current.has(key))
        throw new Error('Your username is still saving. Try again shortly.')
      pendingProfileSaves.current.add(key)
      const generation = operationGeneration.current
      const account = accountGeneration.current
      const request = ++profileSave.current
      profileVersions.current.set(
        key,
        (profileVersions.current.get(key) ?? 0) + 1,
      )
      const isCurrent = () =>
        generation === operationGeneration.current &&
        account === accountGeneration.current &&
        currentUserKey.current === key &&
        request === profileSave.current
      try {
        const displayName = await authGateway.saveProfileName(user, name.trim())
        if (!isCurrent()) return false
        initializedProfiles.current.set(key, displayName)
        setState((current) =>
          current.status === 'signed-in' && userKey(current.user) === key
            ? {
                error: null,
                status: 'signed-in',
                user: { ...current.user, displayName },
              }
            : current,
        )
        return true
      } catch {
        if (!isCurrent()) return false
        throw new Error('We could not save your username. Try again.')
      } finally {
        pendingProfileSaves.current.delete(key)
      }
    },
    [authGateway, state],
  )

  const requestEmailChange = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim()
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail))
        throw new Error('Enter a valid email address.')
      if (
        state.status !== 'signed-in' ||
        !state.user.id ||
        currentUserKey.current !== userKey(state.user)
      )
        throw new Error('Sign in again to change your email.')
      if (normalizedEmail.toLowerCase() === state.user.email.toLowerCase())
        throw new Error(
          'Enter an email address different from your current one.',
        )
      const user = state.user
      const key = userKey(user)
      const generation = operationGeneration.current
      const account = accountGeneration.current
      try {
        await authGateway.requestEmailChange(user, normalizedEmail)
        return (
          generation === operationGeneration.current &&
          account === accountGeneration.current &&
          currentUserKey.current === key
        )
      } catch (error) {
        if (
          generation !== operationGeneration.current ||
          account !== accountGeneration.current ||
          currentUserKey.current !== key
        )
          return false
        throw new Error(
          errorMessage(
            error,
            'We could not request the email change. Try again.',
          ),
        )
      }
    },
    [authGateway, state],
  )

  const changePassword = useCallback(
    async (currentPassword: string, password: string, nonce?: string) => {
      if (
        state.status !== 'signed-in' ||
        !state.user.id ||
        currentUserKey.current !== userKey(state.user)
      )
        throw new Error('Sign in again to change your password.')
      if (!currentPassword) throw new Error('Enter your current password.')
      if (!password || password.length < 8)
        throw new Error('Use a password with at least 8 characters.')
      if (nonce !== undefined && !nonce.trim())
        throw new Error('Enter the verification code we sent you.')

      const user = state.user
      const key = userKey(user)
      const generation = operationGeneration.current
      const account = accountGeneration.current
      const request = authGateway.changePassword
      if (!request)
        throw new Error('Password changes are not available right now.')
      const isCurrent = () =>
        generation === operationGeneration.current &&
        account === accountGeneration.current &&
        currentUserKey.current === key
      try {
        const result = await request(user, currentPassword, password, nonce)
        if (!isCurrent()) return false
        return result
      } catch (error) {
        if (!isCurrent()) return false
        throw new Error(
          errorMessage(error, 'We could not change your password. Try again.'),
        )
      }
    },
    [authGateway, state],
  )

  const value = useMemo(
    () => ({
      changePassword,
      requestEmailChange,
      requestPasswordRecovery,
      saveProfileName,
      resetPassword,
      retrySession,
      signIn,
      signOut,
      signUp,
      state,
    }),
    [
      changePassword,
      requestEmailChange,
      requestPasswordRecovery,
      saveProfileName,
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

import { createSupabaseBrowserClient } from '../data/supabase/client'
import { createRepositories } from '../data/supabase/repositories'
import { getVerificationRedirectUrl } from './authRedirects'
import { normalizeProfileName, safeProfileDisplayName } from './profileName'
import type { AuthGateway, AuthUser } from './context'

function mapUser(user: {
  id: string
  email?: string | null
  user_metadata?: { display_name?: unknown }
}): AuthUser {
  return {
    displayName: safeProfileDisplayName(
      user.user_metadata?.display_name,
      user.email ?? '',
    ),
    email: user.email ?? '',
    id: user.id,
  }
}

export function mapSupabaseAuthError(
  error: { message?: string; status?: number } | null,
  operation: 'password-recovery' | 'password-update' | 'sign-in' | 'sign-up',
) {
  const message = error?.message?.toLowerCase() ?? ''

  if (error?.status === 429 || message.includes('rate')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  if (operation === 'sign-in' && message.includes('invalid login')) {
    return 'The email or password is incorrect. Check them and try again.'
  }
  if (
    operation === 'password-update' &&
    (message.includes('expired') ||
      message.includes('invalid') ||
      message.includes('session'))
  ) {
    return 'This recovery link is invalid or expired. Request a new link.'
  }
  if (
    operation === 'sign-up' &&
    (message.includes('already registered') ||
      message.includes('already exists'))
  ) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (error?.status === undefined && message.includes('fetch')) {
    return 'We could not reach authentication. Check your connection and try again.'
  }
  if (operation === 'sign-in') {
    return 'We could not sign you in. Check your details and try again.'
  }
  if (operation === 'sign-up') {
    return 'We could not create your account. Check your details and try again.'
  }
  if (operation === 'password-recovery') {
    return 'We could not request a recovery link. Try again.'
  }
  return 'We could not update your password. Request a new recovery link.'
}

export function createSupabaseAuthGateway(): AuthGateway {
  const clientResult = createSupabaseBrowserClient()

  function getConfiguredClient() {
    if (clientResult.state !== 'configured')
      throw new Error(clientResult.message)
    return clientResult.client
  }

  return {
    async requestEmailChange(user, email) {
      const client = getConfiguredClient()
      const { data, error: sessionError } = await client.auth.getUser()
      if (sessionError || !user.id || data.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const { error } = await client.auth.updateUser({ email })
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (error.status === 429 || message.includes('rate'))
          throw new Error('Too many attempts. Wait a moment and try again.')
        if (message.includes('email_exists') || message.includes('already'))
          throw new Error('That email cannot be used. Check it or try another.')
        if (message.includes('invalid') || message.includes('validation'))
          throw new Error('Enter a valid email address and try again.')
        if (error.status === undefined && message.includes('fetch'))
          throw new Error('Check your connection and try again.')
        throw new Error('We could not request the email change. Try again.')
      }
    },
    async saveProfileName(user, name) {
      const displayName = normalizeProfileName(name)
      if (!displayName)
        throw new Error('Enter a username between 1 and 80 characters.')
      const client = getConfiguredClient()
      const { data, error } = await client.auth.getUser()
      if (error || !user.id || data.user?.id !== user.id)
        throw new Error('Your account changed. Open Profile and try again.')
      const result = await createRepositories(client).profiles.saveName({
        id: user.id,
        displayName,
      })
      if (result.state !== 'success')
        throw new Error('We could not save your username. Try again.')
      return result.data.displayName
    },
    async ensureProfile(user) {
      const profile = await createRepositories(
        getConfiguredClient(),
      ).profiles.ensure({
        displayName: normalizeProfileName(user.displayName),
        id: user.id!,
      })
      if (profile.state === 'error') throw new Error(profile.error.message)
      return profile.state === 'success'
        ? safeProfileDisplayName(profile.data.displayName, user.email)
        : undefined
    },
    async getSession() {
      if (clientResult.state === 'missing-configuration') return null
      const { data, error } = await getConfiguredClient().auth.getSession()
      if (error)
        throw new Error('We could not restore your session. Try again.')
      return data.session?.user ? mapUser(data.session.user) : null
    },
    onAuthStateChange(callback) {
      if (clientResult.state !== 'configured') return () => undefined
      const { data } = clientResult.client.auth.onAuthStateChange(
        (event, session) => {
          callback(session?.user ? mapUser(session.user) : null, event)
        },
      )
      return () => data.subscription.unsubscribe()
    },
    async requestPasswordRecovery(email, redirectTo) {
      const { error } = await getConfiguredClient().auth.resetPasswordForEmail(
        email,
        { redirectTo },
      )
      if (error) {
        throw new Error(mapSupabaseAuthError(error, 'password-recovery'))
      }
    },
    async resetPassword(password) {
      const { error } = await getConfiguredClient().auth.updateUser({
        password,
      })
      if (error) {
        throw new Error(mapSupabaseAuthError(error, 'password-update'))
      }
    },
    async signIn(email, password) {
      const { data, error } =
        await getConfiguredClient().auth.signInWithPassword({
          email,
          password,
        })
      if (error || !data.user) {
        throw new Error(mapSupabaseAuthError(error, 'sign-in'))
      }
      return mapUser(data.user)
    },
    async signUp(name, email, password) {
      const { data, error } = await getConfiguredClient().auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: getVerificationRedirectUrl(),
        },
      })
      if (error) throw new Error(mapSupabaseAuthError(error, 'sign-up'))
      return {
        needsVerification: !data.session,
        user: data.user ? mapUser(data.user) : null,
      }
    },
    async signOut() {
      if (clientResult.state === 'missing-configuration') return
      const { error } = await getConfiguredClient().auth.signOut()
      if (error) throw new Error('We could not sign you out. Try again.')
    },
  }
}

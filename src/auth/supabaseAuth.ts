import { createSupabaseBrowserClient } from '../data/supabase/client'
import { createRepositories } from '../data/supabase/repositories'
import type { AuthGateway, AuthUser } from './context'

function mapUser(user: {
  id: string
  email?: string | null
  user_metadata?: { display_name?: unknown }
}): AuthUser {
  return {
    displayName:
      typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name
        : undefined,
    email: user.email ?? '',
    id: user.id,
  }
}

export function mapSupabaseAuthError(
  error: { message?: string; status?: number } | null,
  operation: 'sign-in' | 'sign-up',
) {
  const message = error?.message?.toLowerCase() ?? ''

  if (error?.status === 429 || message.includes('rate')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  if (operation === 'sign-in' && message.includes('invalid login')) {
    return 'The email or password is incorrect. Check them and try again.'
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
  return operation === 'sign-in'
    ? 'We could not sign you in. Check your details and try again.'
    : 'We could not create your account. Check your details and try again.'
}

export function createSupabaseAuthGateway(): AuthGateway {
  const clientResult = createSupabaseBrowserClient()

  function getConfiguredClient() {
    if (clientResult.state !== 'configured')
      throw new Error(clientResult.message)
    return clientResult.client
  }

  return {
    async ensureProfile(user) {
      const profile = await createRepositories(
        getConfiguredClient(),
      ).profiles.ensure({
        displayName: user.displayName?.trim() || user.email,
        id: user.id!,
      })
      if (profile.state === 'error') throw new Error(profile.error.message)
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
        (_event, session) => {
          callback(session?.user ? mapUser(session.user) : null)
        },
      )
      return () => data.subscription.unsubscribe()
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
        options: { data: { display_name: name.trim() } },
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

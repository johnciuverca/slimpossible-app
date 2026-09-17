import { createSupabaseBrowserClient } from '../data/supabase/client'
import type { AuthGateway, AuthUser } from './context'

function mapUser(user: { id: string; email?: string | null }): AuthUser {
  return { email: user.email ?? '', id: user.id }
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
  return {
    async signIn(email, password) {
      const result = createSupabaseBrowserClient()
      if (result.state !== 'configured') throw new Error(result.message)
      const { data, error } = await result.client.auth.signInWithPassword({
        email,
        password,
      })
      if (error || !data.user) {
        throw new Error(mapSupabaseAuthError(error, 'sign-in'))
      }
      return mapUser(data.user)
    },
    async signUp(name, email, password) {
      const result = createSupabaseBrowserClient()
      if (result.state !== 'configured') throw new Error(result.message)
      const { data, error } = await result.client.auth.signUp({
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
  }
}

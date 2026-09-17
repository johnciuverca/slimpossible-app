import { createSupabaseBrowserClient } from '../data/supabase/client'
import type { AuthGateway, AuthUser } from './context'

function mapUser(user: { id: string; email?: string | null }): AuthUser {
  return { email: user.email ?? '', id: user.id }
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
      if (error || !data.user)
        throw new Error(error?.message ?? 'Unable to sign in.')
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
      if (error) throw new Error(error.message)
      return {
        needsVerification: !data.session,
        user: data.user ? mapUser(data.user) : null,
      }
    },
  }
}

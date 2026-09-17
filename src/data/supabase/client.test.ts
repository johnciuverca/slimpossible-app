import { describe, expect, it } from 'vitest'

import {
  createSupabaseBrowserClient,
  invalidSupabaseConfigurationMessage,
} from './client'

describe('createSupabaseBrowserClient', () => {
  it('returns the safe missing state without creating a remote request', () => {
    expect(createSupabaseBrowserClient({})).toEqual({
      message:
        'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      state: 'missing-configuration',
    })
  })

  it('creates a typed client from public configuration only', () => {
    const result = createSupabaseBrowserClient({
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    })

    expect(result.state).toBe('configured')
  })

  it('returns a safe error for an invalid public URL', () => {
    expect(
      createSupabaseBrowserClient({
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
        VITE_SUPABASE_URL: 'not-a-url',
      }),
    ).toEqual({
      message: invalidSupabaseConfigurationMessage,
      state: 'invalid-configuration',
    })
  })
})

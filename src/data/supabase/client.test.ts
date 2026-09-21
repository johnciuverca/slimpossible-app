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
    const environment = {
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    }
    const result = createSupabaseBrowserClient(environment)

    expect(result.state).toBe('configured')
  })

  it('reuses the configured client for the same public configuration', () => {
    const environment = {
      VITE_SUPABASE_ANON_KEY: 'cached-anon-key',
      VITE_SUPABASE_URL: 'https://cached-project.supabase.co',
    }

    const first = createSupabaseBrowserClient(environment)
    const second = createSupabaseBrowserClient(environment)

    expect(first.state).toBe('configured')
    expect(second.state).toBe('configured')
    if (first.state === 'configured' && second.state === 'configured') {
      expect(second.client).toBe(first.client)
    }
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

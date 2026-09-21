import { describe, expect, it } from 'vitest'

import {
  getAuthenticationEnvironmentLabel,
  getSupabaseConfiguration,
  localAuthenticationLabel,
  missingSupabaseConfigurationMessage,
  remoteAuthenticationLabel,
} from './supabaseConfig'

describe('getSupabaseConfiguration', () => {
  it('returns a clear safe state when either public variable is missing', () => {
    expect(getSupabaseConfiguration({})).toEqual({
      message: missingSupabaseConfigurationMessage,
      state: 'missing-configuration',
    })
    expect(
      getSupabaseConfiguration({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toEqual({
      message: missingSupabaseConfigurationMessage,
      state: 'missing-configuration',
    })
  })

  it('reads trimmed public configuration without initiating a remote request', () => {
    expect(
      getSupabaseConfiguration({
        VITE_SUPABASE_ANON_KEY: ' public-anon-key ',
        VITE_SUPABASE_URL: ' https://project.supabase.co ',
      }),
    ).toEqual({
      anonKey: 'public-anon-key',
      state: 'configured',
      url: 'https://project.supabase.co',
    })
  })

  it('labels the authentication mode from the public configuration', () => {
    expect(getAuthenticationEnvironmentLabel({})).toBe(localAuthenticationLabel)
    expect(
      getAuthenticationEnvironmentLabel({
        VITE_SUPABASE_ANON_KEY: 'public-anon-key',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toBe(remoteAuthenticationLabel)
  })
})

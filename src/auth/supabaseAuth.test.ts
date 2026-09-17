import { describe, expect, it } from 'vitest'

import { mapSupabaseAuthError } from './supabaseAuth'

describe('mapSupabaseAuthError', () => {
  it('maps invalid credentials without exposing provider details', () => {
    expect(
      mapSupabaseAuthError(
        { message: 'Invalid login credentials; token=secret' },
        'sign-in',
      ),
    ).toBe('The email or password is incorrect. Check them and try again.')
  })

  it('maps duplicate accounts and rate limits to actionable messages', () => {
    expect(
      mapSupabaseAuthError({ message: 'User already registered' }, 'sign-up'),
    ).toContain('already exists')
    expect(mapSupabaseAuthError({ status: 429 }, 'sign-in')).toContain(
      'Too many attempts',
    )
  })

  it('uses a generic safe fallback for unknown provider errors', () => {
    expect(
      mapSupabaseAuthError(
        { message: 'internal provider detail and access_token=secret' },
        'sign-up',
      ),
    ).toBe(
      'We could not create your account. Check your details and try again.',
    )
  })
})

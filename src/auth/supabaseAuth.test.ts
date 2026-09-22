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

  it('keeps recovery requests account-neutral and explains expired reset links', () => {
    expect(
      mapSupabaseAuthError(
        { message: 'User not found; email=person@example.com' },
        'password-recovery',
      ),
    ).toBe('We could not request a recovery link. Try again.')
    expect(
      mapSupabaseAuthError(
        { message: 'Recovery session has expired' },
        'password-update',
      ),
    ).toBe('This recovery link is invalid or expired. Request a new link.')
  })
})

import { describe, expect, it } from 'vitest'

import {
  getRecoveryRedirectUrl,
  getVerificationRedirectUrl,
  isRecoveryCallback,
  safeInternalPath,
} from './authRedirects'

describe('authentication redirect helpers', () => {
  it('creates fixed same-origin verification and recovery destinations', () => {
    expect(getVerificationRedirectUrl('https://app.example.com')).toBe(
      'https://app.example.com/login',
    )
    expect(getRecoveryRedirectUrl('https://app.example.com')).toBe(
      'https://app.example.com/reset-password',
    )
  })

  it('recognizes recovery callbacks only on the reset route', () => {
    expect(
      isRecoveryCallback({
        hash: '',
        pathname: '/reset-password',
        search: '?type=recovery',
      }),
    ).toBe(true)
    expect(
      isRecoveryCallback({
        hash: '#access_token=redacted&type=recovery',
        pathname: '/reset-password',
        search: '',
      }),
    ).toBe(true)
    expect(
      isRecoveryCallback({
        hash: '',
        pathname: '/login',
        search: '?type=recovery',
      }),
    ).toBe(false)
  })

  it('rejects external return locations while preserving internal paths', () => {
    expect(safeInternalPath({ from: { pathname: '//outside.example' } })).toBe(
      '/today',
    )
    expect(
      safeInternalPath({
        from: { hash: '#chart', pathname: '/progress', search: '?week=1' },
      }),
    ).toBe('/progress?week=1#chart')
  })
})

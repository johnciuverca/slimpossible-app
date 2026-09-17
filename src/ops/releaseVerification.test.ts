import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const guide = readFileSync(
  resolve(process.cwd(), 'docs/release-verification.md'),
  'utf8',
)

describe('release verification guide', () => {
  it('separates injected CI checks from owner-run live verification', () => {
    expect(guide).toContain('CI and local verification')
    expect(guide).toContain('Owner-run live verification')
    expect(guide).toContain('session after a page refresh')
    expect(guide).toContain('public.profiles')
    expect(guide).toContain('anonymous requests cannot access')
  })

  it('does not permit secrets or production data in the verification path', () => {
    expect(guide).toContain('Never put a password, service-role key')
    expect(guide).toContain('dedicated non-production')
    expect(guide).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
  })
})

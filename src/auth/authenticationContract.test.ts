import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const contract = readFileSync(
  resolve(process.cwd(), 'docs/authentication-ux-contract.md'),
  'utf8',
)

describe('real authentication UX contract', () => {
  it('defines ownership, minimum sign-up fields, and required UX states', () => {
    expect(contract).toContain(
      'Supabase Auth owns the email/password credential',
    )
    expect(contract).toContain(
      'The minimum application profile field is `display_name`',
    )
    expect(contract).toContain('email, password, password confirmation, and')
    expect(contract).toContain('`configuration-missing`')
    expect(contract).toContain('`verification-pending`')
    expect(contract).toContain('`recovery-ready`')
    expect(contract).toContain('`network-error`')
  })

  it('keeps future integration work explicitly excluded', () => {
    expect(contract).toContain(
      'Issue #122 does not implement Supabase sign-up/sign-in/recovery calls (#123)',
    )
    expect(contract).toContain('session protection (#124)')
    expect(contract).toContain('profile persistence (#125)')
    expect(contract).toContain('verification (#126)')
    expect(contract).not.toContain('service-role key')
  })
})

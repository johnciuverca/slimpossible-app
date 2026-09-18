import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const guide = readFileSync(
  resolve(process.cwd(), 'docs/supabase-staging-setup.md'),
  'utf8',
)
const evidence = readFileSync(
  resolve(process.cwd(), 'docs/supabase-staging-evidence.md'),
  'utf8',
)
const schema = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260917000000_create_core_schema.sql',
  ),
  'utf8',
)
const policies = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260917000001_add_rls_policies.sql',
  ),
  'utf8',
)

describe('Supabase staging setup contract', () => {
  it('documents owner confirmation and public configuration boundaries', () => {
    expect(guide).toContain('disposable')
    expect(guide).toContain('non-production')
    expect(guide).toContain('20260917000000_create_core_schema.sql')
    expect(guide).toContain('20260917000001_add_rls_policies.sql')
    expect(guide).toContain('VITE_SUPABASE_URL')
    expect(guide).toContain('VITE_SUPABASE_ANON_KEY')
    expect(guide).toContain('not evidence')
  })

  it('covers the migration contract without claiming live database access', () => {
    for (const table of [
      'profiles',
      'challenges',
      'participants',
      'weigh_ins',
    ]) {
      expect(schema).toContain(`create table public.${table}`)
    }
    expect(policies).toContain(
      'alter table public.profiles enable row level security',
    )
    expect(policies).toContain('create policy profiles_insert_own')
    expect(policies).toContain(
      'create policy participants_select_owned_or_self',
    )
    expect(policies).toContain('auth.uid()')
  })

  it('does not permit privileged credentials in the browser path', () => {
    expect(guide).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
    expect(guide).toContain('service-role key')
  })

  it('keeps live evidence distinct from prepared or mocked checks', () => {
    expect(evidence).toContain('blocked before request')
    expect(evidence).toContain('not verified live')
    expect(evidence).toContain('SUPABASE_ANON_KEY')
    expect(evidence).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
})

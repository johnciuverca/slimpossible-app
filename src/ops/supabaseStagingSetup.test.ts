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
const candidateMigrations = [
  '20260917000000_create_core_schema.sql',
  '20260917000001_add_rls_policies.sql',
  '20260922000000_harden_rls_authorization.sql',
  '20260922000001_add_secure_challenge_invites.sql',
  '20260924000000_add_privacy_safe_group_progress.sql',
  '20260925000000_add_provisional_group_leader_summary.sql',
  '20261005000000_add_personal_group_challenge_kinds.sql',
  '20261005000001_converge_function_execute_grants.sql',
  '20261006000000_add_opt_in_group_weigh_in_history.sql',
  '20261007000000_personal_weigh_ins.sql',
  '20261008000000_allow_draft_group_weigh_in_sharing.sql',
  '20261009000000_add_group_chart_history.sql',
  '20261012000000_add_group_target_change_milestones.sql',
  '20261012100000_add_group_member_progress_projection.sql',
  '20261013000000_correct_own_enrollment_starting_weight.sql',
  '20261016000000_require_active_challenge_membership.sql',
  '20261018000000_allow_group_owners_to_view_summaries.sql',
]

function listedMigrations(document: string) {
  return [...document.matchAll(/^\s*- `([^`]+\.sql)`$/gm)].map(
    (match) => match[1],
  )
}

describe('Supabase staging setup contract', () => {
  it('documents owner confirmation and public configuration boundaries', () => {
    expect(guide).toContain('disposable')
    expect(guide).toContain('non-production')
    expect(listedMigrations(guide)).toEqual(candidateMigrations)
    expect(guide).toContain('Its 17')
    expect(guide).toContain("8 of the candidate's 17 migrations")
    expect(guide).toContain('hosted staging migration')
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

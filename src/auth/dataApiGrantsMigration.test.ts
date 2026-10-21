import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const personalMigration = read(
  'supabase/migrations/20261007000000_personal_weigh_ins.sql',
)
const milestoneMigration = read(
  'supabase/migrations/20261012000000_add_group_target_change_milestones.sql',
)
const grantAudit = read('supabase/tests/data_api_grants_no_auto.sql')
const localRunner = read('supabase/tests/run_local_data_api_grants.sh')
const releaseGuide = read('docs/release-workflow.md')

describe('public-table Data API grant audit', () => {
  it('keeps the current personal-entry SELECT contract explicit and owner-scoped', () => {
    expect(personalMigration).toContain(
      'grant select on public.personal_weigh_ins to authenticated',
    )
    expect(personalMigration).toContain('using (user_id = (select auth.uid()))')
    expect(personalMigration).toMatch(
      /revoke all on public\.personal_weigh_ins, public\.personal_weigh_in_group_shares,\s+public\.personal_weigh_in_legacy_map from public, anon, authenticated;/,
    )
    expect(personalMigration).not.toMatch(/grant\s+\w+.*to anon/i)
  })

  it('keeps internal tables RLS-enabled and without direct API grants', () => {
    expect(personalMigration).toContain(
      'alter table public.personal_weigh_in_group_shares enable row level security',
    )
    expect(personalMigration).toContain(
      'alter table public.personal_weigh_in_legacy_map enable row level security',
    )
    expect(milestoneMigration).toContain(
      'alter table public.participant_target_milestones enable row level security',
    )
    expect(milestoneMigration).toContain(
      'revoke all on public.participant_target_milestones from public, anon, authenticated',
    )
    expect(milestoneMigration).not.toMatch(/grant\s+\w+.*to anon/i)
  })

  it('documents and rehearses the current release migration set with defaults disabled', () => {
    expect(localRunner).toContain(
      'revoke all on tables from anon, authenticated, service_role',
    )
    expect(localRunner).toContain(
      'revoke all on sequences from anon, authenticated, service_role',
    )
    for (const tableName of [
      'personal_weigh_ins',
      'personal_weigh_in_group_shares',
      'personal_weigh_in_legacy_map',
      'participant_target_milestones',
    ]) {
      expect(grantAudit).toContain(tableName)
    }
    expect(releaseGuide).toContain(
      'bash supabase/tests/run_local_data_api_grants.sh',
    )
    expect(releaseGuide).toContain('October 30, 2026')
  })
})

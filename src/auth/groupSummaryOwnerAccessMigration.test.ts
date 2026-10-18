import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = read(
  'supabase/migrations/20261018000000_allow_group_owners_to_view_summaries.sql',
)
const rollback = read(
  'supabase/rollback/20261018000000_allow_group_owners_to_view_summaries.sql',
)
const authorizationHarness = read(
  'supabase/tests/personal_weigh_in_authorization.sql',
)

describe('Group summary owner authorization migration', () => {
  it('allows a group owner or active member without widening personal challenges', () => {
    for (const functionName of [
      'get_group_progress_summary',
      'get_provisional_group_leader_summary',
    ]) {
      expect(migration).toContain(
        `create or replace function public.${functionName}`,
      )
      const functionSql = migration.slice(
        migration.indexOf(`create or replace function public.${functionName}`),
        migration.indexOf(
          '$$;',
          migration.indexOf(
            `create or replace function public.${functionName}`,
          ),
        ),
      )
      expect(functionSql).toContain('security definer')
      expect(functionSql).toContain(
        'set search_path = pg_catalog, public, auth',
      )
      expect(functionSql).toContain(
        "challenge.challenge_kind is distinct from 'personal'",
      )
      expect(functionSql).toContain('challenge.owner_id = auth.uid()')
      expect(functionSql).toContain("member.status = 'active'")
    }

    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to authenticated')
    expect(migration).not.toMatch(
      /\b(insert into|update public|delete from|truncate)\b/i,
    )
  })

  it('covers unenrolled owners, active members, outsider denials, and a data-safe rollback', () => {
    for (const check of [
      'non_enrolled_owner_receives_safe_group_summary',
      'non_enrolled_owner_receives_safe_provisional_summary',
      'active_member_receives_provisional_summary',
      'outsider_cannot_read_group_summary',
      'outsider_cannot_read_provisional_summary',
    ]) {
      expect(authorizationHarness).toContain(check)
    }
    expect(authorizationHarness.trimEnd()).toMatch(/rollback;$/)

    expect(rollback).toContain(
      'create or replace function public.get_group_progress_summary',
    )
    expect(rollback).toContain(
      'create or replace function public.get_provisional_group_leader_summary',
    )
    expect(rollback).toContain("member.status = 'active'")
    expect(rollback).not.toMatch(
      /\b(insert into|update public|delete from|truncate|drop table)\b/i,
    )
    expect(rollback.trimEnd()).toMatch(/commit;$/)
  })
})

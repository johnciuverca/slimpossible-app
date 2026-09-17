import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260917000001_add_rls_policies.sql',
  ),
  'utf8',
)

describe('row-level security migration contract', () => {
  it('enables RLS on every application table', () => {
    expect(migration).toMatch(
      /alter table public\.profiles enable row level security/,
    )
    expect(migration).toMatch(
      /alter table public\.challenges enable row level security/,
    )
    expect(migration).toMatch(
      /alter table public\.participants enable row level security/,
    )
    expect(migration).toMatch(
      /alter table public\.weigh_ins enable row level security/,
    )
  })

  it('defines explicit ownership and participant policy families', () => {
    expect(migration).toContain('create policy profiles_select_own')
    expect(migration).toContain('create policy challenges_insert_owned')
    expect(migration).toContain(
      'create policy participants_select_owned_or_self',
    )
    expect(migration).toContain('create policy weigh_ins_insert_own')
    expect(migration).toContain('to authenticated')
  })

  it('keeps the group summary aggregate-only', () => {
    const summaryFunction = migration.slice(
      migration.indexOf('create or replace function'),
    )

    expect(summaryFunction).toContain('count(distinct p.id)')
    expect(summaryFunction).toContain('max(w.recorded_date)')
    expect(summaryFunction).not.toContain('w.weight_kg')
    expect(summaryFunction).not.toContain('w.note')
    expect(summaryFunction).not.toContain('p.display_name')
  })
})

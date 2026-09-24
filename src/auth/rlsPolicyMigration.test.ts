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
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260922000000_harden_rls_authorization.sql',
  ),
  'utf8',
)
const inviteMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260922000001_add_secure_challenge_invites.sql',
  ),
  'utf8',
)
const groupProgressMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260924000000_add_privacy_safe_group_progress.sql',
  ),
  'utf8',
)
const groupProgressAuthorizationCheck = readFileSync(
  resolve(process.cwd(), 'supabase/tests/group_progress_authorization.sql'),
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

  it('hardens member visibility and membership reassignment', () => {
    expect(hardeningMigration).toContain(
      'create or replace function public.is_challenge_member',
    )
    expect(hardeningMigration).toContain(
      'create policy challenges_select_owned_or_member',
    )
    expect(hardeningMigration).toContain(
      'create or replace function public.prevent_participant_user_reassignment',
    )
    expect(hardeningMigration).toContain(
      'create trigger prevent_participant_user_reassignment',
    )
    expect(hardeningMigration).toContain('weigh_ins.participant_id = old.id')
    expect(hardeningMigration).toContain("errcode = '42501'")
  })

  it('keeps invite creation, acceptance, and ownership server-authorized', () => {
    expect(inviteMigration).toContain('create table public.challenge_invites')
    expect(inviteMigration).toContain(
      'create or replace function public.create_challenge_invite',
    )
    expect(inviteMigration).toContain(
      "encode(extensions.digest(raw_token, 'sha256'), 'hex')",
    )
    expect(inviteMigration).toContain(
      "encode(extensions.gen_random_bytes(32), 'hex')",
    )
    expect(inviteMigration).toContain(
      'create or replace function public.accept_challenge_invite',
    )
    expect(inviteMigration).toContain('auth.uid()')
    expect(inviteMigration).toContain(
      'on conflict (challenge_id, user_id) do nothing',
    )
    expect(inviteMigration).toContain(
      'create or replace function public.prevent_challenge_ownership_change',
    )
    expect(inviteMigration).toContain(
      'create or replace function public.prevent_participant_user_reassignment',
    )
    expect(inviteMigration).toContain(
      'revoke all on table public.challenge_invites from anon, authenticated',
    )
  })

  it('exposes group progress only through a membership-checked safe RPC', () => {
    expect(groupProgressMigration).toContain(
      'create or replace function public.get_group_progress_summary',
    )
    expect(groupProgressMigration).toContain('security definer')
    expect(groupProgressMigration).toContain('member.user_id = auth.uid()')
    expect(groupProgressMigration).toContain("member.status = 'active'")
    expect(groupProgressMigration).toContain("errcode = '42501'")
    expect(groupProgressMigration).toContain(
      'extract(dow from target_current_sunday) <> 0',
    )
    expect(groupProgressMigration).toContain(
      'current_record.weight_kg - previous_record.weight_kg as weight_change',
    )
    expect(groupProgressMigration).toContain('min(candidate.weight_change)')
    expect(groupProgressMigration).toContain(
      'grant execute on function public.get_group_progress_summary(uuid, date) to authenticated',
    )
    expect(groupProgressMigration).toContain('from public, anon, authenticated')

    const returnedColumns = groupProgressMigration
      .slice(
        groupProgressMigration.indexOf('returns table ('),
        groupProgressMigration.indexOf('language plpgsql'),
      )
      .toLowerCase()
    expect(returnedColumns).not.toMatch(/note|weight_kg|participant_id|user_id/)
    expect(groupProgressAuthorizationCheck).toContain(
      "('unrelated_user_is_denied', true)",
    )
    expect(groupProgressAuthorizationCheck).toContain(
      "('late_sunday_entry_recomputes_shared_result',",
    )
    expect(groupProgressAuthorizationCheck).toContain(
      "('corrected_sunday_entry_recomputes_winner',",
    )
  })
})

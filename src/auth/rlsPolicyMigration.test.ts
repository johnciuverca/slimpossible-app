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
const provisionalLeaderMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260925000000_add_provisional_group_leader_summary.sql',
  ),
  'utf8',
)
const groupProgressAuthorizationCheck = readFileSync(
  resolve(process.cwd(), 'supabase/tests/group_progress_authorization.sql'),
  'utf8',
)
const personalGroupChallengeMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261005000000_add_personal_group_challenge_kinds.sql',
  ),
  'utf8',
)
const personalGroupChallengeRollback = readFileSync(
  resolve(
    process.cwd(),
    'supabase/rollback/20261005000000_add_personal_group_challenge_kinds.sql',
  ),
  'utf8',
)
const personalGroupChallengeAuthorizationCheck = readFileSync(
  resolve(
    process.cwd(),
    'supabase/tests/personal_group_challenges_authorization.sql',
  ),
  'utf8',
)
const executeGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20261005000001_converge_function_execute_grants.sql',
  ),
  'utf8',
)
const executeGrantRecovery = readFileSync(
  resolve(
    process.cwd(),
    'supabase/rollback/20261005000001_converge_function_execute_grants.sql',
  ),
  'utf8',
)

describe('row-level security migration contract', () => {
  it('corrects only inspected explicit grants and guards intervening ACL drift', () => {
    expect(executeGrantMigration).toContain('aclexplode')
    expect(executeGrantMigration).toContain('ACL drift')
    expect(executeGrantMigration).toMatch(
      /revoke execute on function[\s\S]+from anon;/,
    )
    expect(executeGrantMigration).toMatch(
      /revoke execute on function public\.prevent_challenge_kind_change\(\),\s+public\.prevent_personal_challenge_invites\(\) from authenticated;/,
    )
    expect(executeGrantMigration).not.toMatch(/alter default privileges/i)
    expect(executeGrantMigration).not.toMatch(
      /revoke[^;]*is_challenge_member[^;]*from authenticated/i,
    )
    expect(executeGrantMigration).not.toMatch(
      /revoke[^;]*preview_challenge_invite/i,
    )
    expect(executeGrantMigration).not.toMatch(/revoke[^;]*from service_role/i)
  })

  it('restores the observed grants with drift protection, without touching data', () => {
    expect(executeGrantRecovery).toContain('ACL drift')
    expect(executeGrantRecovery).toMatch(
      /grant execute on function[\s\S]+to anon;/,
    )
    expect(executeGrantRecovery).toMatch(
      /grant execute on function public\.prevent_challenge_kind_change\(\),\s+public\.prevent_personal_challenge_invites\(\) to authenticated;/,
    )
    for (const sql of [executeGrantMigration, executeGrantRecovery]) {
      expect(sql).not.toMatch(
        /(?:insert into|update|delete from|alter table|drop table) public\./i,
      )
      expect(sql).toContain('begin;')
      expect(sql).toContain('commit;')
    }
  })

  it('adds personal/group context without rewriting legacy challenges', () => {
    expect(personalGroupChallengeMigration).toMatch(
      /add column challenge_kind text/i,
    )
    expect(personalGroupChallengeMigration).toMatch(
      /challenge_kind is null or challenge_kind in \('personal', 'group'\)/i,
    )
    expect(personalGroupChallengeMigration).not.toMatch(/default\s+'group'/i)
    expect(personalGroupChallengeMigration).not.toMatch(
      /update\s+public\.challenges/i,
    )
    expect(personalGroupChallengeMigration).not.toMatch(/public\.weigh_ins/i)
  })

  it('keeps personal challenges owner-private and blocks group-sharing paths', () => {
    expect(personalGroupChallengeMigration).toContain(
      'personal_challenges_limit_participant_insert',
    )
    expect(personalGroupChallengeMigration).toContain(
      'personal_challenges_limit_participant_update',
    )
    expect(personalGroupChallengeMigration).toContain('as restrictive')
    expect(personalGroupChallengeMigration).toContain(
      'participants.user_id <> auth.uid()',
    )
    expect(personalGroupChallengeMigration).toContain(
      "challenge.challenge_kind is distinct from 'personal'",
    )
    expect(personalGroupChallengeMigration).toContain(
      'personal_challenges_limit_participant_select',
    )
    expect(personalGroupChallengeMigration).toContain(
      'create or replace function public.is_challenge_member',
    )
    expect(personalGroupChallengeMigration).toContain(
      'prevent_challenge_kind_change',
    )
    expect(personalGroupChallengeMigration).toContain(
      'prevent_personal_challenge_invites',
    )
    expect(personalGroupChallengeRollback).toContain(
      "where challenge_kind = 'personal'",
    )
    expect(personalGroupChallengeRollback).toContain('Rollback refused')
    expect(personalGroupChallengeRollback).toContain(
      'create or replace function public.is_challenge_member',
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      "('owner_creation_did_not_enroll_owner', visible_count = 0",
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      "('member_cannot_read_personal_challenge', visible_count = 0",
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      "('member_cannot_read_personal_participants', visible_count = 0",
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      "('outsider_cannot_read_either_context', visible_count = 0",
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      'REPLACE_OWNER_UUID',
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      'REPLACE_MEMBER_UUID',
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain(
      'REPLACE_OUTSIDER_UUID',
    )
    expect(personalGroupChallengeAuthorizationCheck).toContain('rollback;')
    expect(personalGroupChallengeAuthorizationCheck).not.toContain(
      'order by created_at',
    )
    expect(personalGroupChallengeAuthorizationCheck).not.toContain(
      'delete from public.',
    )
  })

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
    expect(groupProgressAuthorizationCheck).toMatch(
      /set_config\('request\.jwt\.claim\.sub', unrelated_id::text, true\);\s*if auth\.uid\(\) is distinct from unrelated_id then[\s\S]*?begin\s*perform \* from public\.get_group_progress_summary\(challenge_id, '2026-09-20'\);\s*insert into slimpossible_group_progress_checks values\s*\('unrelated_user_is_denied', false\)/,
    )
    expect(groupProgressAuthorizationCheck).toContain(
      "('late_sunday_entry_recomputes_shared_result',",
    )
    expect(groupProgressAuthorizationCheck).toContain(
      "('corrected_sunday_entry_recomputes_winner',",
    )
  })

  it('exposes provisional leaders through a separate privacy-safe member RPC', () => {
    expect(provisionalLeaderMigration).toContain(
      'create or replace function public.get_provisional_group_leader_summary',
    )
    expect(provisionalLeaderMigration).toContain('security definer')
    expect(provisionalLeaderMigration).toContain('member.user_id = auth.uid()')
    expect(provisionalLeaderMigration).toContain("member.status = 'active'")
    expect(provisionalLeaderMigration).toContain(
      'weigh_in.recorded_date between week_start and week_end',
    )
    expect(provisionalLeaderMigration).toContain(
      'weigh_in.recorded_date <= target_current_date',
    )
    expect(provisionalLeaderMigration).toContain(
      'baseline.recorded_date = baseline_date',
    )
    expect(provisionalLeaderMigration).toContain('min(candidate.weight_change)')
    expect(provisionalLeaderMigration).toContain("then 'solo-challenge'")
    expect(provisionalLeaderMigration).toContain(
      'grant execute on function public.get_provisional_group_leader_summary(uuid, date)\n  to authenticated',
    )
    const returnedColumns = provisionalLeaderMigration
      .slice(
        provisionalLeaderMigration.indexOf('returns table ('),
        provisionalLeaderMigration.indexOf('language plpgsql'),
      )
      .toLowerCase()
    expect(returnedColumns).not.toMatch(/weight|note|participant_id|user_id/)
    expect(groupProgressMigration).not.toContain(
      'get_provisional_group_leader_summary',
    )
  })
})

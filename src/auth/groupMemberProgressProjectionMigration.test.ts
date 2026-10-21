import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = read(
  'supabase/migrations/20261012100000_add_group_member_progress_projection.sql',
)
const authorizationCheck = read(
  'supabase/tests/group_member_progress_projection_authorization.sql',
)
const rollback = read(
  'supabase/rollback/20261012100000_add_group_member_progress_projection.sql',
)

describe('Group member progress projection SQL contract', () => {
  it('limits access and returns only the selected group progress projection', () => {
    expect(migration).toContain(
      'create function public.get_group_member_progress(target_challenge_id uuid)',
    )
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, public, auth')
    expect(migration).toContain('auth.uid() is null')
    expect(migration).toContain("member.status = 'active'")
    expect(migration).toContain(
      "challenge.challenge_kind is distinct from 'personal'",
    )
    expect(migration).toContain('share.challenge_id = target_challenge_id')
    expect(migration).toContain(
      'personal.recorded_date >= member.joined_at::date',
    )
    expect(migration).toContain('personal.recorded_date <= current_date')
    expect(migration).toContain(
      "md5(target_challenge_id::text || ':' || member.user_id::text)",
    )
    expect(migration).toContain('greatest(0::numeric, least(100::numeric')
    expect(migration).toContain('round(greatest(0::numeric, least(100::numeric')
    expect(migration).toContain('jsonb_build_object(')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain(
      'grant execute on function public.get_group_member_progress(uuid)\n  to authenticated',
    )

    const returnedColumns = migration.slice(
      migration.indexOf('returns table'),
      migration.indexOf('language plpgsql'),
    )
    expect(returnedColumns).not.toMatch(
      /\b(?:weight_kg|note|email|user_id|participant_id|personal_weigh_ins)\b/i,
    )
    expect(migration).not.toMatch(/\b(?:insert|update|delete|alter table)\b/i)
  })

  it('covers privacy, formula edge cases, eligibility, evidence refresh, and rollback', () => {
    for (const check of [
      'active_member_gets_own_group_projection',
      'latest_shared_nonfuture_entry_wins',
      'projection_excludes_weights_notes_and_raw_ids',
      'milestones_contain_only_shared_achievements',
      'peer_midpoint_uses_clamped_loss_formula',
      'percentage_is_rounded_to_one_decimal',
      'gain_above_start_clamps_to_zero',
      'equal_start_and_target_is_reached_without_fabricated_date',
      'target_above_start_is_unavailable',
      'missing_shared_current_entry_is_unavailable',
      'withdrawn_member_is_not_in_projection',
      'challenge_owner_can_read_group_projection',
      'unshare_refreshes_latest_date_and_progress',
      'unshare_hides_milestone_without_qualifying_proof',
      'corrected_shared_evidence_recomputes_progress_and_milestones',
      'delete_refreshes_current_entry_date',
      'outsider_is_denied',
      'withdrawn_viewer_is_denied',
      'personal_challenge_is_denied',
      'null_challenge_is_denied',
      'unknown_challenge_is_denied',
      'sessionless_authenticated_is_denied',
      'anonymous_is_denied',
    ]) {
      expect(authorizationCheck).toContain(check)
    }
    expect(authorizationCheck.trim()).toMatch(/rollback;$/)
    expect(rollback).toContain(
      'drop function if exists public.get_group_member_progress(uuid)',
    )
    expect(rollback).not.toMatch(/drop table|delete from/i)
  })
})

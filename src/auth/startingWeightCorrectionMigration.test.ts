import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')
const migration = read(
  'supabase/migrations/20261013000000_correct_own_enrollment_starting_weight.sql',
)
const authorizationCheck = read(
  'supabase/tests/starting_weight_correction_authorization.sql',
)
const rollback = read(
  'supabase/rollback/20261013000000_correct_own_enrollment_starting_weight.sql',
)

describe('own enrollment starting-weight correction SQL contract', () => {
  it('uses authenticated caller scope and updates only the caller baseline', () => {
    expect(migration).toContain(
      'create function public.correct_my_enrollment_starting_weight(',
    )
    expect(migration).toContain('actor_id uuid := auth.uid()')
    expect(migration).toContain('member.user_id = actor_id')
    expect(migration).toContain("member.status = 'active'")
    expect(migration).toContain('challenge.owner_id = actor_id')
    expect(migration).toContain('for update of member')
    expect(migration).toContain(
      'target_starting_weight_kg <> round(target_starting_weight_kg, 2)',
    )
    expect(migration).toContain(
      'target_starting_weight_kg < participant.target_weight_kg',
    )
    expect(migration).toContain(
      'set starting_weight_kg = target_starting_weight_kg',
    )
    expect(migration).not.toMatch(/set[\s\S]{0,180}target_weight_kg\s*=/i)
    expect(migration).not.toMatch(
      /(?:insert|update|delete)\s+into\s+public\.(?:weigh_ins|personal_weigh_ins|personal_weigh_in_group_shares|participant_target_milestones)/i,
    )
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to authenticated')
  })

  it('records authorization, boundaries, recalculation, preservation and rollback coverage', () => {
    for (const check of [
      'active_group_member_corrects_only_own_start',
      'participant_columns_other_than_start_are_unchanged',
      'peer_baseline_is_unchanged',
      'weigh_in_note_and_share_are_unchanged',
      'reached_target_milestone_is_preserved',
      'selected_group_projection_recalculates_progress',
      'starting_weight_equal_to_target_is_allowed',
      'equal_start_and_target_is_reached',
      'group_owner_can_correct_own_row_only',
      'personal_challenge_owner_can_correct_own_enrollment',
      'below_target_is_rejected',
      'precision_over_two_decimals_is_rejected',
      'nonpositive_start_is_rejected',
      'weight_above_column_bound_is_rejected',
      'personal_challenge_is_owner_only',
      'outsider_is_denied',
      'cross_group_is_denied',
      'withdrawn_member_is_denied',
      'null_challenge_is_denied',
      'anonymous_execution_is_revoked',
    ]) {
      expect(authorizationCheck).toContain(check)
    }
    expect(authorizationCheck.trim()).toMatch(/rollback;$/)
    expect(rollback).toContain(
      'drop function if exists public.correct_my_enrollment_starting_weight(uuid, numeric)',
    )
    expect(rollback).not.toMatch(/drop table|delete from/i)
  })
})

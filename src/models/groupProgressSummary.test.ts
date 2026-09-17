import { describe, expect, it } from 'vitest'

import { createGroupProgressSummary } from './groupProgressSummary'
import type { GroupDashboardAggregation } from './groupDashboardAggregation'

function aggregation(
  overrides: Partial<GroupDashboardAggregation> = {},
): GroupDashboardAggregation {
  return {
    activeParticipantCount: 3,
    averageCompletionPercentage: 50,
    completionState: 'available',
    participantsWithProgressCount: 2,
    participantsWithRecordedWeightCount: 3,
    reachedTargetCount: 1,
    state: 'ready',
    ...overrides,
  }
}

describe('createGroupProgressSummary', () => {
  it('presents safe aggregate completion facts for a ready group', () => {
    expect(createGroupProgressSummary(aggregation())).toEqual({
      activeParticipantCount: 3,
      averageCompletionPercentage: 50,
      message: 'Progress is available for 2 of 3 active participants.',
      participantsWithProgressCount: 2,
      participantsWithRecordedWeightCount: 3,
      reachedTargetCount: 1,
      state: 'ready',
      statusLabel: 'Group progress available',
    })
  })

  it('explains an empty group without claiming progress', () => {
    expect(
      createGroupProgressSummary(
        aggregation({
          activeParticipantCount: 0,
          averageCompletionPercentage: null,
          completionState: 'unavailable',
          participantsWithProgressCount: 0,
          participantsWithRecordedWeightCount: 0,
          reachedTargetCount: 0,
          state: 'empty',
        }),
      ),
    ).toMatchObject({
      averageCompletionPercentage: null,
      message: 'There are no active participants in this challenge yet.',
      state: 'empty',
      statusLabel: 'No active participants',
    })
  })

  it('explains a group with no records without inventing completion', () => {
    expect(
      createGroupProgressSummary(
        aggregation({
          averageCompletionPercentage: null,
          completionState: 'unavailable',
          participantsWithProgressCount: 0,
          participantsWithRecordedWeightCount: 0,
          reachedTargetCount: 0,
          state: 'no-records',
        }),
      ),
    ).toMatchObject({
      averageCompletionPercentage: null,
      message: 'No active participants have recorded a weight yet.',
      state: 'no-records',
      statusLabel: 'No recorded weights',
    })
  })

  it('keeps no-target completion explicitly unavailable when records exist', () => {
    expect(
      createGroupProgressSummary(
        aggregation({
          averageCompletionPercentage: null,
          completionState: 'unavailable',
          participantsWithProgressCount: 0,
          participantsWithRecordedWeightCount: 3,
          reachedTargetCount: 0,
        }),
      ),
    ).toMatchObject({
      averageCompletionPercentage: null,
      message:
        'Recorded weights are available, but target-based group progress is not available yet.',
      state: 'completion-unavailable',
      statusLabel: 'Group progress unavailable',
    })
  })

  it('does not expose identities, cards, raw weights, or private history', () => {
    const summary = createGroupProgressSummary(aggregation())

    expect(summary).not.toHaveProperty('participants')
    expect(summary).not.toHaveProperty('cards')
    expect(summary).not.toHaveProperty('weights')
    expect(summary).not.toHaveProperty('history')
  })
})

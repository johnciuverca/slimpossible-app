import { describe, expect, it } from 'vitest'

import { createLeaderboardPlaceholder } from './leaderboardPlaceholder'

describe('createLeaderboardPlaceholder', () => {
  it('is explicitly unavailable and never creates ranking entries', () => {
    expect(createLeaderboardPlaceholder()).toEqual({
      entries: [],
      message:
        'Leaderboard rankings are unavailable until comparison rules are defined.',
      state: 'rules-required',
      statusLabel: 'Leaderboard coming soon',
    })
  })
})

export type LeaderboardPlaceholder = {
  entries: []
  message: string
  state: 'rules-required'
  statusLabel: string
}

export function createLeaderboardPlaceholder(): LeaderboardPlaceholder {
  return {
    entries: [],
    message:
      'Leaderboard rankings are unavailable until comparison rules are defined.',
    state: 'rules-required',
    statusLabel: 'Leaderboard coming soon',
  }
}

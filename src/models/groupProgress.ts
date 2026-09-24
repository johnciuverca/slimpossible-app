export type GroupProgressSummary = {
  activeParticipantCount: number
  averageCompletionPercentage: number | null
  challengeId: string
  currentSunday: string
  eligibleParticipantCount: number
  participantsWithProgressCount: number
  participantsWithRecordedWeightCount: number
  previousSunday: string
  reachedTargetCount: number
  weeklyWinnerCount: number
  weeklyWinnerNames: string[]
}

export function mostRecentSunday(date = new Date()) {
  const sunday = new Date(date)
  sunday.setUTCHours(0, 0, 0, 0)
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay())
  return sunday.toISOString().slice(0, 10)
}

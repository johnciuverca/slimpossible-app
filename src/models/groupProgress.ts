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
  sunday.setHours(0, 0, 0, 0)
  sunday.setDate(sunday.getDate() - sunday.getDay())

  const year = sunday.getFullYear()
  const month = String(sunday.getMonth() + 1).padStart(2, '0')
  const day = String(sunday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

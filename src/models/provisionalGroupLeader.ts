import type { DateOnly } from './challenge'

export type ProvisionalGroupLeaderSummary = {
  activeParticipantCount: number
  challengeId: string
  currentWeekEnd: DateOnly
  currentWeekStart: DateOnly
  eligibleParticipantCount: number
  leaderCount: number
  leaderLatestDates: DateOnly[]
  leaderNames: string[]
  previousSunday: DateOnly
  state: 'leaders' | 'no-eligible-candidates' | 'solo-challenge'
}

export type ProvisionalWeekDates = {
  currentWeekEnd: DateOnly
  currentWeekStart: DateOnly
  previousSunday: DateOnly
}

function formatDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function localDateOnly(date = new Date()): DateOnly {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function provisionalWeekDates(
  currentDate: DateOnly,
): ProvisionalWeekDates {
  const date = new Date(`${currentDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== currentDate) {
    throw new Error('Current date must be a valid YYYY-MM-DD date.')
  }

  const mondayOffset = (date.getUTCDay() + 6) % 7
  const start = new Date(date)
  start.setUTCDate(start.getUTCDate() - mondayOffset)
  const previousSunday = new Date(start)
  previousSunday.setUTCDate(previousSunday.getUTCDate() - 1)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)

  return {
    currentWeekEnd: formatDateOnly(end),
    currentWeekStart: formatDateOnly(start),
    previousSunday: formatDateOnly(previousSunday),
  }
}

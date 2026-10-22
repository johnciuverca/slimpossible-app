import type { DateOnly } from './challenge'
import type { WeighIn } from './weighIn'

export type PersonalWeeklyChange = {
  changeKg: number | null
  currentWeekStart: DateOnly
  currentWeighIn: WeighIn | null
  previousWeekStart: DateOnly
  previousWeighIn: WeighIn | null
  state: 'no-current-week-record' | 'no-previous-week-record' | 'ready'
}

function weekStart(dateOnly: DateOnly) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function addDays(dateOnly: DateOnly, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function latestInRange(
  weighIns: readonly WeighIn[],
  participantId: string,
  from: DateOnly,
  through: DateOnly,
) {
  return (
    weighIns
      .filter(
        (weighIn) =>
          weighIn.participantId === participantId &&
          weighIn.date >= from &&
          weighIn.date <= through,
      )
      .sort((first, second) => second.date.localeCompare(first.date))[0] ?? null
  )
}

/** Compare the latest saved entry in this local-calendar week with last week's.
 * Missing comparisons remain unavailable instead of being estimated.
 */
export function calculatePersonalWeeklyChange(
  weighIns: readonly WeighIn[],
  participantId: string,
  today: DateOnly,
): PersonalWeeklyChange {
  const currentWeekStart = weekStart(today)
  const previousWeekStart = addDays(currentWeekStart, -7)
  const previousWeekEnd = addDays(currentWeekStart, -1)
  const currentWeighIn = latestInRange(
    weighIns,
    participantId,
    currentWeekStart,
    today,
  )
  const previousWeighIn = latestInRange(
    weighIns,
    participantId,
    previousWeekStart,
    previousWeekEnd,
  )

  if (!currentWeighIn) {
    return {
      changeKg: null,
      currentWeekStart,
      currentWeighIn,
      previousWeekStart,
      previousWeighIn,
      state: 'no-current-week-record',
    }
  }

  if (!previousWeighIn) {
    return {
      changeKg: null,
      currentWeekStart,
      currentWeighIn,
      previousWeekStart,
      previousWeighIn,
      state: 'no-previous-week-record',
    }
  }

  return {
    changeKg: Number(
      (currentWeighIn.weightKg - previousWeighIn.weightKg).toFixed(2),
    ),
    currentWeekStart,
    currentWeighIn,
    previousWeekStart,
    previousWeighIn,
    state: 'ready',
  }
}

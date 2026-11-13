export const WEEKLY_RESULTS_TIME_ZONE = 'Europe/Bucharest'

export type WeeklyEndpoint = {
  committedAt: string
  shared: boolean
  sunday: string
  weightKg: number
}

export type MembershipEpisode = {
  joinedAt: string
  withdrawnAt: string | null
}

export type EligibleSundayValue = {
  estimated: boolean
  sunday: string
  weightKg: number
}

export function mostRecentWeeklySunday(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEEKLY_RESULTS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

export function previousWeeklySunday(sunday: string) {
  const previous = new Date(`${sunday}T00:00:00.000Z`)
  previous.setUTCDate(previous.getUTCDate() - 7)
  return previous.toISOString().slice(0, 10)
}

function zonedInstant(date: string, hour: number, minute = 0) {
  const [year, month, day] = date.split('-').map(Number)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = targetAsUtc
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEEKLY_RESULTS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    )
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const adjustment = targetAsUtc - representedAsUtc
    candidate += adjustment
    if (adjustment === 0) break
  }
  return new Date(candidate)
}

export function weeklyProvisionalCutoff(sunday: string) {
  return zonedInstant(sunday, 20)
}

export function weeklyFinalCutoff(sunday: string) {
  const monday = new Date(`${sunday}T12:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() + 1)
  const mondayDate = monday.toISOString().slice(0, 10)
  return zonedInstant(mondayDate, 20)
}

function beforeCutoff(timestamp: string, cutoff: Date) {
  const value = new Date(timestamp)
  return Number.isFinite(value.getTime()) && value.getTime() < cutoff.getTime()
}

function bucharestCalendarDate(timestamp: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEEKLY_RESULTS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date(timestamp))
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value])
  const dateParts = Object.fromEntries(parts)
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

function roundToFiveHundredths(value: number) {
  return Math.round(value / 0.05) * 0.05
}

export function eligibleSundayValue(input: {
  sunday: string
  finalCutoff: Date
  membership: MembershipEpisode
  endpoints: readonly WeeklyEndpoint[]
}): EligibleSundayValue | null {
  const { sunday, finalCutoff, membership, endpoints } = input
  const joinedAt = Date.parse(membership.joinedAt)
  const withdrawnAt = membership.withdrawnAt
    ? Date.parse(membership.withdrawnAt)
    : null
  if (!Number.isFinite(joinedAt) || joinedAt >= finalCutoff.getTime())
    return null
  if (withdrawnAt !== null && withdrawnAt <= finalCutoff.getTime()) return null

  const eligible = endpoints.filter(
    (endpoint) =>
      endpoint.shared &&
      endpoint.sunday >= bucharestCalendarDate(membership.joinedAt) &&
      Date.parse(endpoint.committedAt) >= joinedAt &&
      beforeCutoff(endpoint.committedAt, finalCutoff),
  )
  const actual = eligible
    .filter((endpoint) => endpoint.sunday === sunday)
    .sort((a, b) => b.committedAt.localeCompare(a.committedAt))[0]
  if (actual) return { estimated: false, sunday, weightKg: actual.weightKg }

  const previous = eligible
    .filter((endpoint) => endpoint.sunday < sunday)
    .sort((a, b) => b.sunday.localeCompare(a.sunday))[0]
  const next = eligible
    .filter((endpoint) => endpoint.sunday > sunday)
    .sort((a, b) => a.sunday.localeCompare(b.sunday))[0]
  if (!previous || !next) return null

  const previousDay = Date.parse(`${previous.sunday}T00:00:00Z`)
  const nextDay = Date.parse(`${next.sunday}T00:00:00Z`)
  const targetDay = Date.parse(`${sunday}T00:00:00Z`)
  if (
    nextDay <= previousDay ||
    targetDay <= previousDay ||
    targetDay >= nextDay
  )
    return null
  const ratio = (targetDay - previousDay) / (nextDay - previousDay)
  const weightKg =
    previous.weightKg + (next.weightKg - previous.weightKg) * ratio
  return { estimated: true, sunday, weightKg: roundToFiveHundredths(weightKg) }
}

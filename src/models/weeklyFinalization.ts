export const WEEKLY_RESULTS_TIME_ZONE = 'Europe/Bucharest'

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

function zonedInstant(date: string, hour: number) {
  const [year, month, day] = date.split('-').map(Number)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour)
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

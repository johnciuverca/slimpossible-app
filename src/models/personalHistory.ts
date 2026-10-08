import type { PersonalWeighIn } from './personalWeighIn'

export function formatPersonalWeight(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} kg`
}
export function formatPersonalChange(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPersonalWeight(Math.abs(value))}`
}

export function personalHistory(
  entries: readonly PersonalWeighIn[],
  today: string,
  days?: number,
) {
  const since = new Date(`${today}T00:00:00.000Z`)
  if (days) since.setUTCDate(since.getUTCDate() - days + 1)
  const start = days ? since.toISOString().slice(0, 10) : ''
  const history = entries
    .filter(({ date }) => date <= today && date >= start)
    .sort((a, b) => b.date.localeCompare(a.date))
  return {
    history,
    latest: history[0] ?? null,
    changeKg:
      history.length > 1
        ? history[0].weightKg - history[history.length - 1].weightKg
        : null,
  }
}

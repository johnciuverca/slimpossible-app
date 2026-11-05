export type DatedWeight = { date: string; weightKg: number }

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000
const dateAt = (dayNumber: number) =>
  new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)

/** Creates display-only daily values strictly between saved date/weight pairs. */
export function interpolateMissingWeights<T extends DatedWeight>(
  entries: readonly T[],
): DatedWeight[] {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const estimates: DatedWeight[] = []
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const next = ordered[index]
    const firstDay = day(previous.date)
    const gap = day(next.date) - firstDay
    if (!Number.isFinite(gap) || gap <= 1) continue
    for (let offset = 1; offset < gap; offset += 1) {
      estimates.push({
        date: dateAt(firstDay + offset),
        weightKg:
          previous.weightKg +
          ((next.weightKg - previous.weightKg) * offset) / gap,
      })
    }
  }
  return estimates
}

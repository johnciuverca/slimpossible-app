export const chartDay = (date: string) =>
  Date.parse(`${date}T00:00:00Z`) / 86400000
export const chartDate = (day: number) =>
  new Date(day * 86400000).toISOString().slice(0, 10)
export type ChartSlot = { start: number; end: number; weekly: boolean }

/** One common display slot per older calendar week, including empty weeks. */
export function compressedChartSlots(
  first: number,
  last: number,
  newest: number,
  expanded: ReadonlySet<string>,
): ChartSlot[] {
  const cutoff = newest - 6
  const slots: ChartSlot[] = []
  for (let date = first; date <= last;) {
    const monday = date - ((new Date(date * 86400000).getUTCDay() + 6) % 7)
    const end = Math.min(last, monday + 6, cutoff - 1)
    const open = [...expanded].some((key) => key.endsWith(chartDate(monday)))
    if (date >= cutoff || open) {
      slots.push({ start: date, end: date, weekly: false })
      date++
    } else {
      slots.push({ start: date, end, weekly: true })
      date = end + 1
    }
  }
  return slots
}
export function slotIndex(slots: ChartSlot[], date: number) {
  return Math.max(
    0,
    slots.findIndex((slot) => date >= slot.start && date <= slot.end),
  )
}

export type DatedWeight = { date: string; weightKg: number }

export const ESTIMATED_HISTORY_PAGE_SIZE = 30

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000
const dateAt = (dayNumber: number) =>
  new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)
const roundWeightKg = (weightKg: number) =>
  Math.round((weightKg + Number.EPSILON) * 20) / 20
const estimateBetween = (
  previous: DatedWeight,
  next: DatedWeight,
  targetDay: number,
) => {
  const firstDay = day(previous.date)
  const gap = day(next.date) - firstDay
  return roundWeightKg(
    previous.weightKg +
      ((next.weightKg - previous.weightKg) * (targetDay - firstDay)) / gap,
  )
}

function validDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const dayNumber = day(date)
  return Number.isInteger(dayNumber) && dateAt(dayNumber) === date
    ? dayNumber
    : null
}

function dateRangesForSeries(series: readonly (readonly DatedWeight[])[]) {
  const ranges: { start: number; end: number }[] = []
  for (const entries of series) {
    const days = [
      ...new Set(
        entries.flatMap(({ date, weightKg }) => {
          const value = validDay(date)
          return value !== null && Number.isFinite(weightKg) && weightKg > 0
            ? [value]
            : []
        }),
      ),
    ].sort((a, b) => a - b)
    for (let index = 0; index < days.length; index += 1) {
      const current = days[index]
      ranges.push({ start: current, end: current })
      const next = days[index + 1]
      if (next !== undefined && next - current > 1)
        ranges.push({ start: current + 1, end: next - 1 })
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end + 1)
      last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

function historyDatePage(
  merged: readonly { start: number; end: number }[],
  requestedPage: number,
  pageSize: number,
) {
  const totalDates = merged.reduce(
    (count, range) => count + range.end - range.start + 1,
    0,
  )
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 30
  const pageCount = Math.ceil(totalDates / size)
  const pageIndex = Math.max(
    0,
    Math.min(
      Number.isInteger(requestedPage) ? requestedPage : 0,
      pageCount - 1,
    ),
  )
  let skip = pageIndex * size
  const dates: string[] = []
  for (
    let index = merged.length - 1;
    index >= 0 && dates.length < size;
    index -= 1
  ) {
    const range = merged[index]
    const count = range.end - range.start + 1
    if (skip >= count) {
      skip -= count
      continue
    }
    let current = range.end - skip
    skip = 0
    while (current >= range.start && dates.length < size) {
      dates.push(dateAt(current))
      current -= 1
    }
  }
  const firstPosition = totalDates === 0 ? 0 : pageIndex * size + 1
  return {
    dates,
    pageIndex,
    pageCount,
    pageSize: size,
    totalDates,
    firstPosition,
    lastPosition: firstPosition + dates.length - 1,
  }
}

export function estimatedHistoryDatePage(
  entries: readonly DatedWeight[],
  requestedPage: number,
  pageSize = ESTIMATED_HISTORY_PAGE_SIZE,
) {
  return historyDatePage(
    dateRangesForSeries([entries]),
    requestedPage,
    pageSize,
  )
}

/** Builds a bounded union of date rows while keeping estimates scoped per series. */
export function estimatedHistoryDatePageForSeries(
  series: readonly (readonly DatedWeight[])[],
  requestedPage: number,
  pageSize = ESTIMATED_HISTORY_PAGE_SIZE,
) {
  return historyDatePage(dateRangesForSeries(series), requestedPage, pageSize)
}

/** Computes only requested dates, retaining the chart's shared interpolation and rounding. */
export function interpolateMissingWeightsForDates<T extends DatedWeight>(
  entries: readonly T[],
  requestedDates: readonly string[],
): DatedWeight[] {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const requested = [
    ...new Set(
      requestedDates.flatMap((date) => {
        const value = validDay(date)
        return value === null ? [] : [value]
      }),
    ),
  ].sort((a, b) => a - b)
  const estimates: DatedWeight[] = []
  let requestedIndex = 0
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const next = ordered[index]
    const firstDay = validDay(previous.date)
    const nextDay = validDay(next.date)
    if (
      firstDay === null ||
      nextDay === null ||
      !Number.isFinite(previous.weightKg) ||
      !Number.isFinite(next.weightKg) ||
      nextDay - firstDay <= 1
    )
      continue
    while (
      requestedIndex < requested.length &&
      requested[requestedIndex] <= firstDay
    )
      requestedIndex += 1
    while (
      requestedIndex < requested.length &&
      requested[requestedIndex] < nextDay
    ) {
      const estimateDay = requested[requestedIndex]
      estimates.push({
        date: dateAt(estimateDay),
        weightKg: estimateBetween(previous, next, estimateDay),
      })
      requestedIndex += 1
    }
  }
  return estimates
}

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
        weightKg: estimateBetween(previous, next, firstDay + offset),
      })
    }
  }
  return estimates
}

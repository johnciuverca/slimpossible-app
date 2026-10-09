export type GroupChartEntry = {
  memberKey: string
  displayName: string
  date: string
  weightKg: number
}

export type GroupChartPoint = GroupChartEntry & { changeKg: number }
export type GroupChartSeries = {
  memberKey: string
  label: string
  baselineDate: string
  points: GroupChartPoint[]
}

// Input is exclusively the authorized RPC projection, never personal rows.
export function createGroupChartHistory(
  entries: GroupChartEntry[],
  today: string,
): GroupChartSeries[] {
  const groups = new Map<string, GroupChartEntry[]>()
  for (const entry of entries) {
    if (
      !entry.memberKey ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
      !Number.isFinite(Date.parse(`${entry.date}T00:00:00Z`)) ||
      entry.date > today ||
      !Number.isFinite(entry.weightKg) ||
      entry.weightKg <= 0
    )
      continue
    const rows = groups.get(entry.memberKey) ?? []
    rows.push(entry)
    groups.set(entry.memberKey, rows)
  }
  const sorted = [...groups].sort(([a], [b]) => a.localeCompare(b))
  const names = new Map<string, number>()
  for (const [, rows] of sorted) {
    const name = rows[0].displayName
    names.set(name, (names.get(name) ?? 0) + 1)
  }
  const ordinals = new Map<string, number>()
  return sorted.map(([memberKey, rows]) => {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    const baseline = rows[0]
    const ordinal = (ordinals.get(baseline.displayName) ?? 0) + 1
    ordinals.set(baseline.displayName, ordinal)
    return {
      memberKey,
      label:
        (names.get(baseline.displayName) ?? 0) > 1
          ? `${baseline.displayName} (member ${ordinal})`
          : baseline.displayName,
      baselineDate: baseline.date,
      points: rows.map((entry) => ({
        ...entry,
        changeKg: Math.round((entry.weightKg - baseline.weightKg) * 100) / 100,
      })),
    }
  })
}

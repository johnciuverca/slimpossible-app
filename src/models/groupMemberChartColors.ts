const GROUP_MEMBER_CHART_PALETTE = [
  '#31dbb0',
  '#67a5ff',
  '#ff8ba7',
  '#c49cff',
  '#ffc164',
] as const

/**
 * Assigns colors from the complete authorized member set, independent of its
 * incoming order. Reuse this map for filtered and individual chart views.
 */
export function createGroupMemberChartColorMap(
  memberKeys: readonly string[],
): Map<string, string> {
  const stableKeys = [...new Set(memberKeys)].sort((a, b) => a.localeCompare(b))
  return new Map(
    stableKeys.map((memberKey, index) => [
      memberKey,
      GROUP_MEMBER_CHART_PALETTE[index % GROUP_MEMBER_CHART_PALETTE.length],
    ]),
  )
}

export const groupMemberChartPaletteSize = GROUP_MEMBER_CHART_PALETTE.length

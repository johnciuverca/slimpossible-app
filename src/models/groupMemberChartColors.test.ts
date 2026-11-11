import { describe, expect, it } from 'vitest'
import {
  createGroupMemberChartColorMap,
  groupMemberChartPaletteSize,
} from './groupMemberChartColors'

describe('Group member chart colors', () => {
  it('assigns colors by stable member key regardless of input order or filtering', () => {
    const memberKeys = ['member-z', 'member-b', 'member-a', 'member-k']
    const colors = createGroupMemberChartColorMap(memberKeys)
    const reordered = createGroupMemberChartColorMap([...memberKeys].reverse())
    const selected = createGroupMemberChartColorMap(memberKeys).get('member-k')

    expect(reordered).toEqual(colors)
    expect(selected).toBe(colors.get('member-k'))
    expect(new Set([...colors.values()]).size).toBe(memberKeys.length)
  })

  it('uses distinct palette colors until the palette is exhausted, then cycles deterministically', () => {
    const keys = Array.from(
      { length: groupMemberChartPaletteSize + 2 },
      (_, index) => `member-${index}`,
    )
    const colors = createGroupMemberChartColorMap(keys)

    expect(
      new Set(
        keys
          .slice(0, groupMemberChartPaletteSize)
          .map((key) => colors.get(key)),
      ).size,
    ).toBe(groupMemberChartPaletteSize)
    expect(colors.get(keys[groupMemberChartPaletteSize])).toBe(
      colors.get(keys[0]),
    )
    expect(colors.get(keys[groupMemberChartPaletteSize + 1])).toBe(
      colors.get(keys[1]),
    )
  })
})

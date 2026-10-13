import { describe, expect, it } from 'vitest'
import { progressBlocks } from './groupMemberProgress'

describe('group member progress blocks', () => {
  it('rounds to the nearest of ten blocks and clamps percentages', () => {
    expect(progressBlocks(0)).toBe(0)
    expect(progressBlocks(4.9)).toBe(0)
    expect(progressBlocks(5)).toBe(1)
    expect(progressBlocks(48.5)).toBe(5)
    expect(progressBlocks(100)).toBe(10)
    expect(progressBlocks(-5)).toBe(0)
    expect(progressBlocks(120)).toBe(10)
    expect(progressBlocks(null)).toBe(0)
  })
})

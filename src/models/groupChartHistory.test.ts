import { describe, expect, it } from 'vitest'
import {
  createGroupChartHistory,
  createGroupHistoryMatrix,
  type GroupChartEntry,
} from './groupChartHistory'
const row = (
  memberKey: string,
  date: string,
  weightKg: number,
): GroupChartEntry => ({ memberKey, displayName: 'Same name', date, weightKg })
const today = '2026-10-08'
describe('authorized Group chart aggregation', () => {
  it('pivots only real dates into exact-weight cells with null gaps and distinct duplicate-name columns', () => {
    const series = createGroupChartHistory(
      [
        row('a', '2026-10-01', 90),
        row('a', '2026-10-03', 88.55),
        row('b', '2026-10-02', 70),
        row('c', '2026-10-01', 60),
        row('b', '2099-10-01', 10),
      ],
      today,
    )
    const matrix = createGroupHistoryMatrix(series)
    expect(matrix.map(({ date }) => date)).toEqual([
      '2026-10-03',
      '2026-10-02',
      '2026-10-01',
    ])
    expect(
      matrix.map(({ cells }) => cells.map((point) => point?.weightKg ?? null)),
    ).toEqual([
      [88.55, null, null],
      [null, 70, null],
      [90, null, 60],
    ])
    expect(
      createGroupHistoryMatrix([series[1]]).map(({ date, cells }) => [
        date,
        cells[0]?.weightKg,
      ]),
    ).toEqual([['2026-10-02', 70]])
    expect(createGroupHistoryMatrix([])).toEqual([])
  })
  it('keeps duplicate names separate and compares each own baseline, not absolute weights', () => {
    const series = createGroupChartHistory(
      [
        row('a', '2026-10-03', 88.5),
        row('b', '2026-10-02', 60),
        row('a', '2026-10-01', 90),
        row('b', '2026-10-01', 59),
      ],
      today,
    )
    expect(series.map(({ label }) => label)).toEqual([
      'Same name (member 1)',
      'Same name (member 2)',
    ])
    expect(
      series.map(({ points }) => points.map(({ changeKg }) => changeKg)),
    ).toEqual([
      [0, -1.5],
      [0, 1],
    ])
    expect(series[0].points.map(({ date }) => date)).toEqual([
      '2026-10-01',
      '2026-10-03',
    ])
  })
  it('recalculates corrections, late baselines, unshares and deletes without stale rows', () => {
    const original = [row('a', '2026-10-03', 90), row('a', '2026-10-05', 88)]
    expect(createGroupChartHistory(original, today)[0].points[1].changeKg).toBe(
      -2,
    )
    expect(
      createGroupChartHistory(
        [original[0], row('a', '2026-10-05', 89)],
        today,
      )[0].points[1].changeKg,
    ).toBe(-1)
    expect(
      createGroupChartHistory(
        [...original, row('a', '2026-10-01', 91)],
        today,
      )[0].points.at(-1)?.changeKg,
    ).toBe(-3)
    expect(
      createGroupChartHistory([original[1]], today)[0].points[0].changeKg,
    ).toBe(0)
    expect(createGroupChartHistory([], today)).toEqual([])
  })
  it('preserves gain, maintenance, single entry and excludes future/invalid points', () => {
    const series = createGroupChartHistory(
      [
        row('a', '2026-10-01', 70),
        row('a', '2026-10-02', 70),
        row('a', '2026-10-03', 71.25),
        row('a', '2026-10-09', 50),
        row('a', '2026-10-04', NaN),
        row('b', '2026-10-08', 60),
      ],
      today,
    )
    expect(series[0].points.map(({ changeKg }) => changeKg)).toEqual([
      0, 0, 1.25,
    ])
    expect(series[1].points[0].changeKg).toBe(0)
  })
})

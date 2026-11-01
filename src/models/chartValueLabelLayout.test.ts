import { expect, it } from 'vitest'
import { layoutChartValueLabels } from './chartValueLabelLayout'

it('preserves the point x-coordinate while assigning centered labels their own rows', () => {
  const positions = layoutChartValueLabels(
    [
      { id: 'middle', x: 107, pointY: 80, text: '90' },
      { id: 'first', x: 100, pointY: 80, text: '90' },
      { id: 'last', x: 114, pointY: 80, text: '90' },
    ],
    760,
    266,
  )

  expect(positions.map(({ x }) => x)).toEqual([100, 107, 114])
  expect(positions[0].y).not.toBe(positions[1].y)
  expect(positions[1].y).not.toBe(positions[2].y)
  expect(positions.every(({ y }) => y >= 7 && y <= 75)).toBe(true)
})

it('leaves sparse labels on their default row and keeps edge labels within the viewBox', () => {
  expect(
    layoutChartValueLabels(
      [
        { id: 'first', x: 64, pointY: 100, text: '80.5' },
        { id: 'last', x: 696, pointY: 160, text: '100' },
      ],
      760,
      266,
    ),
  ).toEqual([
    { id: 'first', x: 64, y: 88 },
    { id: 'last', x: 696, y: 148 },
  ])
})

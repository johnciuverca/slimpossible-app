export type ChartValueLabel = {
  id: string
  x: number
  pointY: number
  text: string
}

export type ChartValueLabelPosition = {
  id: string
  x: number
  y: number
}

const rowHeight = 7
const labelHeight = 6.6
const horizontalPadding = 1

/** Centers each label on its point and assigns nearby labels separate rows. */
export const layoutChartValueLabels = (
  labels: readonly ChartValueLabel[],
  viewBoxWidth: number,
  viewBoxHeight: number,
): ChartValueLabelPosition[] => {
  const sorted = [...labels].sort(
    (first, second) =>
      first.x - second.x ||
      first.pointY - second.pointY ||
      first.id.localeCompare(second.id),
  )
  const placed: Array<ChartValueLabelPosition & { width: number }> = []

  for (const label of sorted) {
    const width = label.text.length * 4.2
    const minimumY = labelHeight + 1
    const maximumY = Math.min(viewBoxHeight - 1, label.pointY - 5)
    const candidates = [0]
    for (let row = 1; row <= Math.ceil(viewBoxHeight / rowHeight); row += 1) {
      candidates.push(-row * rowHeight, row * rowHeight)
    }
    const validCandidates = candidates
      .map((offset) => ({ y: label.pointY - 12 + offset, offset }))
      .filter(
        ({ y }) =>
          y >= minimumY &&
          y <= maximumY &&
          label.x - width / 2 - horizontalPadding >= 0 &&
          label.x + width / 2 + horizontalPadding <= viewBoxWidth,
      )
    const hasCollision = (candidateY: number) =>
      placed.some(
        (other) =>
          Math.abs(label.x - other.x) <
            (width + other.width) / 2 + horizontalPadding * 2 &&
          Math.abs(candidateY - other.y) < rowHeight,
      )
    const chosen = validCandidates.find(({ y }) => !hasCollision(y)) ??
      validCandidates[0] ?? { y: Math.max(minimumY, maximumY), offset: 0 }
    placed.push({ id: label.id, x: label.x, y: chosen.y, width })
  }

  return placed.map(({ id, x, y }) => ({ id, x, y }))
}

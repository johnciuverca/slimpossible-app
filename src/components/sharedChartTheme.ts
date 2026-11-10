/** Shared chart presentation tokens, measured from the staging chart baseline. */
export const sharedChartTheme = {
  axisBaselinePx: 12,
  axisTickScale: 0.85,
  plot: {
    left: 64,
    right: 696,
    top: 30,
    bottomInset: 42,
    compactLeft: 48,
  },
} as const

export const sharedChartAxisTickPx =
  sharedChartTheme.axisBaselinePx * sharedChartTheme.axisTickScale

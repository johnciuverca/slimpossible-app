/**
 * Shared chart presentation source of truth. Change axis sizes, SVG plot bounds,
 * and control spacing here. Axis colors and range-slider handle geometry live
 * in the matching .chart-axis-* and .date-range-handle rules in index.css.
 */
export const sharedChartTheme = {
  axisBaselinePx: 12,
  axisTickScale: 0.85,
  axisTitlePx: 12,
  plot: {
    left: 52,
    right: 708,
    top: 27,
    bottomInset: 36,
    compactLeft: 40,
    compactRightInset: 18,
  },
  dates: {
    weeklyIntervalDays: 7,
    compactIntervalDays: 120,
    compactMaximumTicks: 4,
    averageGlyphWidthEm: 0.53,
    labelCharacters: 10,
    edgeLabelWidthMultiplier: 1.5,
    labelGapPx: 4,
  },
  spacing: {
    framePaddingClass: 'pt-0',
    quickRangesBottomClass: 'mb-2',
    quickRangesGapClass: 'gap-2',
    chartToSliderClass: 'mt-1',
    sliderTrackClass: 'relative h-8 touch-none',
    rangeOutputClass: 'mb-1 block text-center text-xs text-ink-muted',
  },
  rangePreset: {
    baseClass:
      'min-h-9 rounded-full border px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50',
    selectedClass:
      'border-emerald-800 bg-emerald-800 font-semibold text-white shadow-sm hover:bg-emerald-900 dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950',
    idleClass: 'border-line bg-page text-ink hover:bg-panel',
  },
} as const

export const sharedChartAxisTickPx =
  sharedChartTheme.axisBaselinePx * sharedChartTheme.axisTickScale

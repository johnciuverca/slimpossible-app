import { expect, test } from '@playwright/test'

const viewports = [
  { width: 320, height: 800 },
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 390, height: 700 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 },
]

test('Dashboard compactness bounds and screenshots', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    const heading = page.getByRole('heading', { name: 'Dashboard', level: 1 })
    const latest = page.locator('.dashboard-latest')
    const actions = page.locator('.dashboard-actions-compact')
    const chart = page.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(heading).toBeVisible()
    await expect(latest).toBeVisible()
    await expect(actions).toBeVisible()
    await expect(chart).toBeVisible()
    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector)!
        const { x, y, width, height, bottom, right } =
          element.getBoundingClientRect()
        return { x, y, width, height, bottom, right }
      }
      const subnav = rect('.contextual-subnav')
      const heading = rect('#dashboard-title')
      const latest = rect('.dashboard-latest')
      const actions = rect('.dashboard-actions-compact')
      const actionsElement = document.querySelector(
        '.dashboard-actions-compact',
      )!
      const actionsStyle = getComputedStyle(actionsElement)
      const chartElement = document.querySelector<SVGSVGElement>(
        '[role="img"][viewBox]',
      )!
      const chart = rect('[role="img"][viewBox]')
      const viewBoxHeight = Number(
        chartElement.getAttribute('viewBox')?.trim().split(/\s+/)[3],
      )
      const plotTop = Number(chartElement.getAttribute('data-chart-plot-top'))
      const plotBottom = Number(
        chartElement.getAttribute('data-chart-plot-bottom'),
      )
      const plotTopY = chart.y + (plotTop / viewBoxHeight) * chart.height
      const plotBottomY = chart.y + (plotBottom / viewBoxHeight) * chart.height
      return {
        subnavHeadingGap: heading.y - subnav.bottom,
        heading,
        latest,
        actions,
        actionsContentLeft:
          actions.x +
          Number.parseFloat(actionsStyle.borderLeftWidth) +
          Number.parseFloat(actionsStyle.paddingLeft),
        actionsContentRight:
          actions.right -
          Number.parseFloat(actionsStyle.borderRightWidth) -
          Number.parseFloat(actionsStyle.paddingRight),
        compactCardStackHeight: actions.bottom - latest.y,
        chart,
        plotTopY,
        plotBottomY,
        plotHeight: plotBottomY - plotTopY,
        visiblePlotTop: Math.max(0, plotTopY),
        visiblePlotBottom: Math.min(window.innerHeight, plotBottomY),
        visiblePlotHeight: Math.max(
          0,
          Math.min(window.innerHeight, plotBottomY) - plotTopY,
        ),
        viewportHeight: window.innerHeight,
      }
    })
    console.log('dashboard-compactness', viewport, metrics)
    if (viewport.width < 640) {
      const baseline = {
        320: { latest: 164.328125, actions: 114 },
        390: { latest: 124.359375, actions: 114 },
        430: { latest: 124.359375, actions: 66.96875 },
      }[viewport.width]
      const baselineStackHeight = {
        320: 294.328125,
        390: 254.359375,
        430: 207.328125,
      }[viewport.width]
      expect(metrics.subnavHeadingGap).toBeLessThanOrEqual(12)
      expect(metrics.latest.height).toBeLessThanOrEqual(baseline.latest * 0.75)
      expect(metrics.actions.height).toBeLessThanOrEqual(
        baseline.actions * (viewport.width === 320 ? 0.85 : 0.75),
      )
      expect(metrics.compactCardStackHeight).toBeLessThanOrEqual(
        baselineStackHeight * 0.75,
      )
      expect(metrics.visiblePlotHeight).toBeGreaterThanOrEqual(
        viewport.height < 800
          ? viewport.width === 320
            ? 60
            : 150
          : viewport.width === 320
            ? 150
            : metrics.plotHeight - 1,
      )
      const controls = await actions
        .locator(
          '.dashboard-action-grid-compact > a, .dashboard-action-grid-compact > button',
        )
        .all()
      expect(controls).toHaveLength(4)
      for (const control of controls) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(metrics.actionsContentLeft)
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          metrics.actionsContentRight,
        )
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    } else {
      expect(metrics.subnavHeadingGap).toBeCloseTo(44.84375, 1)
      expect(metrics.latest.height).toBeCloseTo(124.359375, 1)
      expect(metrics.actions.height).toBeCloseTo(124.359375, 1)
      expect(metrics.chart.width).toBeCloseTo(1150, 0)
      expect(metrics.chart.height).toBeCloseTo(402.5, 0)
    }
    await page.screenshot({
      path: test
        .info()
        .outputPath(
          `dashboard-${viewport.width}x${viewport.height}-viewport.png`,
        ),
    })
    await page.screenshot({
      path: test
        .info()
        .outputPath(`dashboard-${viewport.width}x${viewport.height}-full.png`),
      fullPage: true,
    })
  }
})

test('mobile save feedback does not shift Dashboard content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(
    '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
  )
  const measureContent = async () => {
    const latest = await page.locator('.dashboard-latest').boundingBox()
    const actions = await page
      .locator('.dashboard-actions-compact')
      .boundingBox()
    const chart = await page
      .getByRole('img', { name: /^Personal weight history chart/ })
      .boundingBox()
    expect(latest).not.toBeNull()
    expect(actions).not.toBeNull()
    expect(chart).not.toBeNull()
    return [latest!.y, latest!.height, actions!.y, actions!.height, chart!.y]
  }
  const before = await measureContent()
  await page
    .locator('.dashboard-latest')
    .getByRole('button', { name: 'Record weight', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Record weight' })
  await dialog.getByLabel('Weight in kg').fill('61.2')
  await dialog.getByRole('button', { name: 'Save weight', exact: true }).click()
  const confirmation = page.locator(
    '.dashboard-save-confirmation[role="status"]',
  )
  await expect(confirmation).toBeVisible()
  await expect(page.locator('.dashboard-save-confirmation-slot')).toHaveCSS(
    'position',
    'fixed',
  )
  await page.screenshot({
    path: test.info().outputPath('dashboard-save-feedback-390.png'),
  })
  expect(await measureContent()).toEqual(before)
  const dismiss = page.getByRole('button', {
    name: 'Dismiss save confirmation',
  })
  await expect(dismiss).toHaveCSS('min-height', '44px')
  await dismiss.click()
  await expect(confirmation).toHaveCount(0)
  expect(await measureContent()).toEqual(before)
})

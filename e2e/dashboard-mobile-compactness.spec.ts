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
    await expect(heading).toHaveClass(/\bsr-only\b/)
    await expect(page.locator('.dashboard-save-confirmation-slot')).toHaveCSS(
      'display',
      'none',
    )
    await expect(page).toHaveTitle('Synthetic Dashboard workspace')
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Dashboard', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(latest).toBeVisible()
    await expect(actions).toBeVisible()
    await expect(latest.getByRole('status')).toHaveCount(0)
    await expect(chart).toBeVisible()
    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector)!
        const { x, y, width, height, bottom, right } =
          element.getBoundingClientRect()
        return { x, y, width, height, bottom, right }
      }
      const subnav = rect('.contextual-subnav')
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
        subnavContentGap: latest.y - subnav.bottom,
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
      expect(metrics.subnavContentGap).toBeGreaterThanOrEqual(0)
      expect(metrics.subnavContentGap).toBeLessThanOrEqual(12)
      expect(metrics.latest.height).toBeLessThanOrEqual(100)
      expect(metrics.actions.height).toBeLessThanOrEqual(100)
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
      const actionCenter = metrics.actions.x + metrics.actions.width / 2
      for (const control of controls) {
        const box = await control.boundingBox()
        expect(Math.abs(box!.x + box!.width / 2 - actionCenter)).toBeLessThan(
          viewport.width === 320 ? 150 : 190,
        )
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    } else {
      expect(metrics.subnavContentGap).toBeLessThanOrEqual(40)
      expect(metrics.subnavContentGap).toBeGreaterThanOrEqual(0)
      expect(metrics.latest.height).toBeCloseTo(metrics.actions.height, 0)
      expect(metrics.actions.height).toBeLessThanOrEqual(76)
      expect(metrics.actions.height).toBeGreaterThanOrEqual(64)
      expect(metrics.chart.width).toBeCloseTo(1150, 0)
      expect(metrics.chart.height).toBeCloseTo(402.5, 0)
      expect(metrics.chart.y).toBeLessThan(400)
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

for (const viewport of [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'desktop', width: 1280, height: 900 },
]) {
  test(`${viewport.label} save feedback does not shift Dashboard content`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    const heading = page.getByRole('heading', { name: 'Dashboard', level: 1 })
    await expect(heading).toHaveClass(/\bsr-only\b/)
    await expect(page.getByRole('region', { name: 'Dashboard' })).toBeVisible()
    await expect(page).toHaveTitle('Synthetic Dashboard workspace')
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Dashboard', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    const subnav = page.getByRole('navigation', { name: 'Dashboard sections' })
    await expect(
      subnav.getByRole('link', { name: 'Overview', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
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
    await dialog
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    const confirmation = page.locator(
      '.dashboard-save-confirmation[role="status"]',
    )
    await expect(confirmation).toBeVisible()
    await expect(page.locator('.dashboard-save-confirmation-slot')).toHaveCSS(
      'position',
      viewport.width < 640 ? 'fixed' : 'absolute',
    )
    await page.screenshot({
      path: test
        .info()
        .outputPath(`dashboard-save-feedback-${viewport.width}.png`),
    })
    expect(await measureContent()).toEqual(before)
    const dismiss = page.getByRole('button', {
      name: 'Dismiss save confirmation',
    })
    if (viewport.width < 640) {
      await expect(dismiss).toHaveCSS('min-height', '44px')
    } else {
      const [slot, actions, controls] = await Promise.all([
        page.locator('.dashboard-save-confirmation-slot').boundingBox(),
        page.locator('.dashboard-actions-compact').boundingBox(),
        page
          .locator(
            '.dashboard-actions-compact .dashboard-action-grid-compact > a, .dashboard-actions-compact .dashboard-action-grid-compact > button',
          )
          .evaluateAll((elements) =>
            elements.map((element) => element.getBoundingClientRect().bottom),
          ),
      ])
      expect(slot).not.toBeNull()
      expect(actions).not.toBeNull()
      const latest = await page.locator('.dashboard-latest').boundingBox()
      expect(latest).not.toBeNull()
      expect(slot!.y).toBeGreaterThanOrEqual(latest!.y - 34)
      expect(slot!.y + slot!.height).toBeLessThanOrEqual(latest!.y + 1)
      expect(Math.max(...controls)).toBeLessThanOrEqual(
        actions!.y + actions!.height,
      )
    }
    await dismiss.click()
    await expect(confirmation).toHaveCount(0)
    expect(await measureContent()).toEqual(before)
  })
}

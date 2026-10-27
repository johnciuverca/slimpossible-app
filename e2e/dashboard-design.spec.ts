import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`approved Dashboard composition, personal trend and Profile at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const ago = (days: number) =>
        new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify([
          ...[0, 3, 9, 20, 60].map((days, index) => ({
            id: `synthetic-visual-${index}`,
            userId: 'user-alex',
            date: ago(days),
            weightKg: [105.2, 104.1, 103.2, 102.1, 80.3][index],
            sharedChallengeIds: [],
            note: 'Synthetic design test',
          })),
        ]),
      )
    })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    await expect(
      page.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeEnabled()
    await expect(page.getByRole('region', { name: 'About you' })).toHaveCount(0)
    for (const action of ['Record weight', 'Invite people', 'Join challenge'])
      await expect(
        page.getByRole('button', { name: action, exact: true }),
      ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Create challenge', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath(`dashboard-overview-${width}.png`),
      fullPage: true,
    })
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    await expect(
      page.getByRole('list', { name: 'Personal weigh-in history' }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', { name: /^Personal weight history chart/ }),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Progress', exact: true })
      .click()
    await expect(
      page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
    ).toHaveCount(0)
    const chart = page.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
    await expect(chart.locator('[data-chart-trend]')).toHaveCount(1)
    await expect(chart.locator('[data-chart-reference]')).toHaveCount(1)
    await expect(chart.locator('[data-chart-trend]')).toHaveAttribute(
      'opacity',
      '0.35',
    )
    await expect(chart.locator('.chart-legend')).toHaveCount(0)
    await expect(chart).toHaveAccessibleDescription(/least-squares fit/)
    await expect(chart.locator('.chart-value')).toHaveCount(5)
    const firstPoint = chart.locator('circle[data-chart-point]').first()
    await firstPoint.hover()
    const pointTooltip = page.getByRole('tooltip')
    await expect(pointTooltip).toBeVisible()
    await expect(pointTooltip).toContainText(/\d{2}\.\d{2}\.\d{4}: 80\.3 kg/)
    await expect(pointTooltip).toHaveClass(/bg-panel/)
    await firstPoint.focus()
    await expect(firstPoint).toHaveAttribute(
      'aria-describedby',
      await pointTooltip.getAttribute('id'),
    )
    await page.keyboard.press('Escape')
    await expect(pointTooltip).toHaveCount(0)
    for (const label of await chart.locator('.chart-value').all())
      await expect(label).toHaveAttribute('font-size', '6.6')
    const yTicks = await chart
      .locator('[data-chart-tick]')
      .evaluateAll((ticks) =>
        ticks.map((tick) => Number(tick.getAttribute('data-chart-tick'))),
      )
    expect(yTicks.every((tick) => tick % 5 === 0)).toBe(true)
    await expect(chart.locator('[data-chart-minor-tick]')).not.toHaveCount(0)
    await expect(
      chart.locator('[data-chart-date-tick]').first(),
    ).toHaveAttribute('font-size', '6.5')
    await expect(page.getByText('Weight (kg)', { exact: true })).toHaveCount(1)
    await chart.screenshot({
      path: test.info().outputPath('personal-chart-narrow-preview.png'),
    })
    const dateControls = page.getByRole('group', {
      name: 'Chart date range controls',
    })
    await expect(dateControls).toBeVisible()
    const dateRangeLabel = await dateControls
      .getByText('Date range', { exact: true })
      .boundingBox()
    const chartBox = await chart.boundingBox()
    expect(dateRangeLabel).not.toBeNull()
    expect(chartBox).not.toBeNull()
    expect(
      Math.abs(
        dateRangeLabel!.x - (chartBox!.x + (64 / 760) * chartBox!.width),
      ),
    ).toBeLessThan(2)
    const sliderTrack = page.getByRole('group', {
      name: 'Adjust visible date range',
    })
    await expect(sliderTrack.getByRole('slider')).toHaveCount(2)
    await dateControls
      .getByRole('button', { name: 'Show last 1 month' })
      .click()
    await expect(chart.locator('circle[data-date]')).toHaveCount(4)
    const recentTicks = await chart
      .locator('[data-chart-tick]')
      .evaluateAll((ticks) =>
        ticks.map((tick) => Number(tick.getAttribute('data-chart-tick'))),
      )
    expect(recentTicks.every((tick) => tick % 5 === 0)).toBe(false)
    await expect(chart.locator('[data-chart-minor-tick]')).toHaveCount(0)
    const startSlider = sliderTrack.getByRole('slider', {
      name: 'Visible range start',
    })
    const originalStart = await startSlider.getAttribute('aria-valuetext')
    await startSlider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(startSlider).not.toHaveAttribute(
      'aria-valuetext',
      originalStart!,
    )
    await dateControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
    const endSlider = sliderTrack.getByRole('slider', {
      name: 'Visible range end',
    })
    if (width === 1280) {
      const endThumb = await endSlider.boundingBox()
      expect(endThumb).not.toBeNull()
      const beforeMouseDrag = await endSlider.getAttribute('aria-valuetext')
      const thumbY = endThumb!.y + endThumb!.height / 2
      const thumbCenterX = endThumb!.x + endThumb!.width / 2
      await page.mouse.move(thumbCenterX, thumbY)
      await page.mouse.down()
      await page.mouse.move(thumbCenterX - 60, thumbY, { steps: 8 })
      await page.mouse.up()
      await expect(endSlider).not.toHaveAttribute(
        'aria-valuetext',
        beforeMouseDrag!,
      )
      await expect(chart.locator('circle[data-date]')).toHaveCount(3)
      await dateControls.getByRole('button', { name: 'Show all dates' }).click()
      await expect(chart.locator('circle[data-date]')).toHaveCount(5)
    }
    const originalEnd = await endSlider.getAttribute('aria-valuetext')
    await endSlider.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(endSlider).not.toHaveAttribute('aria-valuetext', originalEnd!)
    await expect(chart.locator('circle[data-date]')).toHaveCount(4)
    await chart.scrollIntoViewIfNeeded()
    const chartBottomBox = await chart.boundingBox()
    const sliderBox = await sliderTrack.boundingBox()
    expect(sliderBox).not.toBeNull()
    expect(chartBottomBox).not.toBeNull()
    expect(sliderBox!.y).toBeGreaterThan(
      chartBottomBox!.y + chartBottomBox!.height - 1,
    )
    await dateControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
    await expect(
      dateControls.getByRole('button', { name: 'Show all dates' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`dashboard-progress-${width}.png`),
      fullPage: true,
    })
    const account = page.getByLabel(
      'Profile and account for Synthetic account',
      {
        exact: true,
      },
    )
    await account.click()
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Close Profile' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(account).toBeFocused()

    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
  })
}

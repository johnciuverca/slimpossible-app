import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`hides personal chart explanations but retains accessible details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const day = (offset: number) => {
        const date = new Date()
        date.setDate(date.getDate() - offset)
        return date.toISOString().slice(0, 10)
      }
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify(
          [0, 7, 14].map((offset, index) => ({
            id: `copy-check-${index}`,
            userId: 'user-alex',
            date: day(offset),
            weightKg: 90 - index,
            sharedChallengeIds: [],
            note: '',
          })),
        ),
      )
    })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard%3Ftab%3Dprogress',
    )

    const chart = page.getByRole('img', {
      name: /Personal weight history chart\. 3 saved weigh-ins/,
    })
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAccessibleDescription(
      /Hollow points are estimates between saved entries/,
    )
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)
    await expect(
      chart.locator('circle[data-point-kind="weekly-summary"]'),
    ).toHaveCount(2)
    const explanation = page.getByText(
      /Solid points are saved personal entries/,
    )
    await expect(explanation).toHaveClass('sr-only')
    await expect(
      page.getByText(/3 saved weigh-ins from \d{2}\.\d{2}\.\d{4} to/),
    ).toHaveClass('sr-only')

    const firstPoint = chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
    await firstPoint.hover()
    await expect(page.getByRole('tooltip')).toBeVisible()

    const captionBox = await page
      .locator('.personal-weight-chart figcaption')
      .boundingBox()
    expect(captionBox?.width).toBe(1)
    expect(captionBox?.height).toBe(1)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width)
  })

  test(`hides Group chart explanations but keeps selected-member details at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/e2e/fixtures/group-chart-harness.html')
    const chartRegion = page.getByRole('region', {
      name: 'Scrollable shared group weights',
    })
    const chart = page.getByRole('img').first()
    await expect(chartRegion).toBeVisible()
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAccessibleDescription(
      /latest 7 calendar dates stay detailed.*Monday–Sunday averages/,
    )
    await expect(
      page.getByText(/Explicitly shared dates and weights only/),
    ).toHaveClass('sr-only')
    await expect(
      page.getByText(/Hollow points estimate missing dates only/),
    ).toHaveClass('sr-only')

    const hiddenExplanations = [
      page.getByText(/Explicitly shared dates and weights only/),
      page.getByText(/Hollow points estimate missing dates only/),
    ]
    for (const explanation of hiddenExplanations) {
      const box = await explanation.boundingBox()
      expect(box?.width).toBe(1)
      expect(box?.height).toBe(1)
      await expect(explanation).toHaveCSS('position', 'absolute')
    }

    await page.getByRole('tab', { name: 'Synthetic Alex' }).click()
    await expect(chart).toHaveAccessibleDescription(
      /Points represent shared dates/,
    )
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(3)
    await chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
      .hover()
    await expect(page.getByRole('tooltip')).toContainText('Synthetic Alex')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width)
  })
}

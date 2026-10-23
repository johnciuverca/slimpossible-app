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
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )

    const chart = page.getByRole('img', {
      name: /Personal weight history chart\. 3 saved weigh-ins/,
    })
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAccessibleDescription(
      /dashed trend is a least-squares fit/,
    )
    await expect(chart.locator('circle[data-date]')).toHaveCount(3)
    const explanation = page.getByText(
      /Every plotted point is a saved personal entry/,
    )
    await expect(explanation).toHaveClass('sr-only')
    await expect(
      page.getByText(/3 saved weigh-ins from \d{4}-\d{2}-\d{2} to/),
    ).toHaveClass('sr-only')

    const firstPoint = chart.locator('circle[data-chart-point]').first()
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
      /Points represent shared dates/,
    )
    await expect(
      page.getByText(/Explicitly shared dates and weights only/),
    ).toHaveClass('sr-only')
    await expect(
      page.getByText(/Missing dates are gaps, not estimated weights/),
    ).toHaveClass('sr-only')

    const hiddenExplanations = [
      page.getByText(/Explicitly shared dates and weights only/),
      page.getByText(/Missing dates are gaps, not estimated weights/),
    ]
    for (const explanation of hiddenExplanations) {
      const box = await explanation.boundingBox()
      expect(box?.width).toBe(1)
      expect(box?.height).toBe(1)
      await expect(explanation).toHaveCSS('position', 'absolute')
    }

    await page.getByRole('tab', { name: 'Synthetic Alex' }).click()
    await expect(chart.locator('circle[data-date]')).toHaveCount(3)
    await chart.locator('circle[data-chart-point]').first().hover()
    await expect(page.getByRole('tooltip')).toContainText('Synthetic Alex')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width)
  })
}

import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`labels only the Dashboard range extremes and keeps labels inside the plot at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const ago = (days: number) =>
        new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify(
          [60, 59, 58, 0].map((days, index) => ({
            id: `synthetic-chart-label-${index}`,
            userId: 'user-alex',
            date: ago(days),
            weightKg: index === 3 ? 85 : 90,
            sharedChallengeIds: [],
            note: 'Synthetic label-layout test',
          })),
        ),
      )
    })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard%3Ftab%3Dprogress',
    )

    const chart = page.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-chart-point]'),
    ).toHaveCount(4)
    await expect(chart.locator('.chart-value')).toHaveCount(2)
    const labels = await chart.locator('.chart-value').evaluateAll((elements) =>
      elements.map((element) => ({
        date: element.getAttribute('data-date'),
        text: element.textContent ?? '',
        x: Number(element.getAttribute('x')),
        y: Number(element.getAttribute('y')),
        anchor: element.getAttribute('text-anchor'),
        value: Number(element.getAttribute('data-weight-kg')),
      })),
    )
    const points = await chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          date: element.getAttribute('data-date'),
          x: Number(element.getAttribute('cx')),
          y: Number(element.getAttribute('cy')),
          value: Number(element.getAttribute('data-weight-kg')),
        })),
      )

    const minValue = Math.min(...points.map((point) => point.value))
    const maxValue = Math.max(...points.map((point) => point.value))
    expect(labels.map((label) => label.value)).toEqual([maxValue, minValue])
    expect(labels.map((label) => label.date)).toEqual([
      points.find((point) => point.value === maxValue)!.date,
      points.find((point) => point.value === minValue)!.date,
    ])
    for (const label of labels) {
      const point = points.find((candidate) => candidate.date === label.date)
      expect(point).toBeDefined()
      expect(label.anchor).toBe('middle')
      expect(label.y).toBeLessThan(point!.y)
      expect(label.y).toBeGreaterThan(0)
      const estimatedHalfWidth =
        (label.text.length * (width <= 600 ? 4.05 : 3.15)) / 2
      expect(label.x - estimatedHalfWidth).toBeGreaterThanOrEqual(
        width <= 600 ? 42 : 0,
      )
      expect(label.x + estimatedHalfWidth).toBeLessThanOrEqual(
        width <= 600 ? 312 : 760,
      )
    }
    await chart.screenshot({
      path: test.info().outputPath(`chart-value-labels-${width}px.png`),
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  })
}

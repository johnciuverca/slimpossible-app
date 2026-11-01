import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`centers every personal chart value and staggers clustered labels at ${width}px`, async ({
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
    await expect(chart.locator('circle[data-chart-point]')).toHaveCount(4)
    await expect(chart.locator('.chart-value')).toHaveCount(4)
    const labels = await chart.locator('.chart-value').evaluateAll((elements) =>
      elements.map((element) => ({
        date: element.getAttribute('data-date'),
        text: element.textContent ?? '',
        x: Number(element.getAttribute('x')),
        y: Number(element.getAttribute('y')),
        anchor: element.getAttribute('text-anchor'),
      })),
    )
    const points = await chart
      .locator('circle[data-chart-point]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          date: element.getAttribute('data-date'),
          x: Number(element.getAttribute('cx')),
          y: Number(element.getAttribute('cy')),
        })),
      )

    for (const label of labels) {
      const point = points.find((candidate) => candidate.date === label.date)
      expect(point).toBeDefined()
      expect(label.anchor).toBe('middle')
      expect(label.x).toBe(point!.x)
      expect(label.y).toBeLessThan(point!.y)
      expect(label.y).toBeGreaterThan(0)
      const estimatedHalfWidth = (label.text.length * 4.2) / 2
      expect(label.x - estimatedHalfWidth).toBeGreaterThan(0)
      expect(label.x + estimatedHalfWidth).toBeLessThan(760)
    }

    const clustered = labels.filter((label) => label.text === '90')
    expect(clustered).toHaveLength(3)
    for (const first of clustered) {
      for (const second of clustered) {
        if (first === second) continue
        const horizontalGap = Math.abs(first.x - second.x)
        const labelsOverlapHorizontally =
          horizontalGap < ((first.text.length + second.text.length) * 4.2) / 2
        if (labelsOverlapHorizontally)
          expect(Math.abs(first.y - second.y)).toBeGreaterThanOrEqual(7)
      }
    }
    await chart.screenshot({
      path: test.info().outputPath(`chart-value-labels-${width}px.png`),
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  })
}

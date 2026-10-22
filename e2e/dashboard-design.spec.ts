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
            weightKg: [96, 96.5, 97.2, 98, 95][index],
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
    for (const action of [
      'Record weight',
      'Invite people',
      'Join with invitation',
    ])
      await expect(
        page.getByRole('button', { name: action, exact: true }),
      ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Create challenge', exact: true }),
    ).toBeVisible()
    const chart = page.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
    const pointLabels = chart.locator('.chart-value')
    await expect(pointLabels).toHaveCount(5)
    for (const label of await pointLabels.all())
      await expect(label).toHaveAttribute('font-size', '5')
    await expect(chart.locator('circle[data-date]').first()).toHaveAttribute(
      'data-date',
      /.+/,
    )
    await expect(chart.locator('circle[data-date]').first()).toHaveAttribute(
      'data-weight-kg',
      '95',
    )
    await expect(chart.locator('circle title').last()).toContainText(
      'kg recorded',
    )
    await expect(chart.locator('[data-chart-trend]')).toHaveCount(1)
    await expect(chart.locator('[data-chart-reference]')).toHaveCount(1)
    await expect(page.getByText('Weight (kg)', { exact: true })).toHaveCount(1)
    await expect(
      page.getByRole('list', { name: 'Personal chart legend' }),
    ).toHaveCount(0)
    const chartGeometry = await chart.evaluate((svg) => {
      const labels = [...svg.querySelectorAll<SVGTextElement>('.chart-value')]
      const points = [
        ...svg.querySelectorAll<SVGCircleElement>('circle[data-date]'),
      ]
      const view = svg.viewBox.baseVal
      const boxes = labels.map((label) => label.getBBox())
      return {
        labelsAbovePoints: labels.every((label, index) => {
          const point = points[index]
          return (
            label.dataset.date === point.dataset.date &&
            label.dataset.weightKg === point.dataset.weightKg &&
            label.getBBox().y + label.getBBox().height <
              Number(point.getAttribute('cy')) - 5
          )
        }),
        insideViewBox: boxes.every(
          (box) =>
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= view.width &&
            box.y + box.height <= view.height,
        ),
        noLabelOverlap: boxes.every((box, index) =>
          boxes
            .slice(index + 1)
            .every(
              (other) =>
                box.x + box.width <= other.x ||
                other.x + other.width <= box.x ||
                box.y + box.height <= other.y ||
                other.y + other.height <= box.y,
            ),
        ),
        ticks: [...svg.querySelectorAll<SVGGElement>('[data-chart-tick]')].map(
          (tick) => Number(tick.dataset.chartTick),
        ),
        scrollWidth: svg.parentElement?.scrollWidth,
        clientWidth: svg.parentElement?.clientWidth,
      }
    })
    expect(chartGeometry.labelsAbovePoints).toBe(true)
    expect(chartGeometry.insideViewBox).toBe(true)
    expect(chartGeometry.noLabelOverlap).toBe(true)
    expect(
      chartGeometry.ticks.every(
        (tick, index) =>
          index === 0 || tick - chartGeometry.ticks[index - 1] === 1,
      ),
    ).toBe(true)
    expect(chartGeometry.scrollWidth).toBeGreaterThanOrEqual(
      chartGeometry.clientWidth ?? 0,
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`dashboard-overview-${width}.png`),
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

  test(`every dense chart label stays non-overlapping and unclipped at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const start = Date.UTC(2026, 0, 1)
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify(
          Array.from({ length: 40 }, (_, index) => ({
            id: `dense-chart-${index}`,
            userId: 'user-alex',
            date: new Date(start + index * 86400000).toISOString().slice(0, 10),
            weightKg: 95 + Math.sin(index / 5) * 0.6,
            sharedChallengeIds: [],
            note: 'Synthetic dense chart test',
          })),
        ),
      )
    })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    const chart = page.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(chart.locator('circle[data-date]')).toHaveCount(40)
    await expect(chart.locator('.chart-value')).toHaveCount(40)
    const metrics = await chart.evaluate((svg) => {
      const labels = [...svg.querySelectorAll<SVGTextElement>('.chart-value')]
      const boxes = labels.map((label) => label.getBBox())
      const view = svg.viewBox.baseVal
      return {
        fontSizes: labels.map((label) => label.getAttribute('font-size')),
        insideViewBox: boxes.every(
          (box) =>
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= view.width &&
            box.y + box.height <= view.height,
        ),
        noLabelOverlap: boxes.every((box, index) =>
          boxes
            .slice(index + 1)
            .every(
              (other) =>
                box.x + box.width <= other.x ||
                other.x + other.width <= box.x ||
                box.y + box.height <= other.y ||
                other.y + other.height <= box.y,
            ),
        ),
      }
    })
    expect(metrics.fontSizes.every((fontSize) => fontSize === '5')).toBe(true)
    expect(metrics.insideViewBox).toBe(true)
    expect(metrics.noLabelOverlap).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`dense-chart-${width}.png`),
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

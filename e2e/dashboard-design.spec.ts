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
            weightKg: [96, 96.5, 97.2, 98, 40][index],
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
    await expect(chart.locator('[data-chart-trend]')).toHaveCount(1)
    await expect(chart.locator('[data-chart-reference]')).toHaveCount(1)
    await expect(
      page.getByRole('list', { name: 'Personal chart legend' }),
    ).toContainText('Derived trend')
    await expect(page.getByText('Weight (kg)', { exact: true })).toHaveCount(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`dashboard-overview-${width}.png`),
      fullPage: true,
    })
    const account = page.getByText('Synthetic account', { exact: true })
    await account.click()
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Close Profile' }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(account.locator('..')).toBeFocused()

    await expect(chart.locator('circle[data-date]')).toHaveCount(5)
  })
}

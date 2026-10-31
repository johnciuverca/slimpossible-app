import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`Weigh-ins inline editor protects a draft and restores navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto(
      '/e2e/fixtures/personal-dashboard-harness.html?scenario=accounts&path=/weigh-ins',
    )
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    const date = await history.locator('time').first().getAttribute('datetime')
    const edit = history.getByRole('button', {
      name: `Edit weight ${date}`,
      exact: true,
    })
    await edit.click()
    const weight = page.getByLabel('Weight in kg')
    await expect(weight).toBeFocused()
    await expect(weight).toHaveValue('90')
    await weight.fill('89')
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    const discard = page.getByRole('dialog', {
      name: 'Discard unsaved input?',
    })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(weight).toHaveValue('89')
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(
      page.getByRole('img', { name: /^Personal weight history chart/ }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  })
}

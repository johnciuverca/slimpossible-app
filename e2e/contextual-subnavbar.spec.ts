import { expect, test } from '@playwright/test'

const fixture = (path = '/dashboard') =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

for (const width of [1280, 320]) {
  test(`contextual navigation selects content, preserves drafts and supports keyboard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture())
    const sections = page.getByRole('navigation', {
      name: 'Dashboard sections',
    })
    const overview = sections.getByRole('link', {
      name: 'Overview',
      exact: true,
    })
    await overview.focus()
    await page.keyboard.press('Enter')
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText('Latest weight')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Your personal trend' }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', { name: /^Personal weight history chart/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Fixture back' }).click()
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Fixture forward' }).click()
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await sections.getByRole('link', { name: 'Weigh-ins' }).click()
    await expect(
      page.getByRole('link', { name: 'Dashboard', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    const input = page.getByLabel('Weight in kg', { exact: true }).first()
    await input.fill('83.2')
    await overview.click()
    await expect(
      page.getByRole('dialog', { name: 'Discard unsaved input?' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(input).toHaveValue('83.2')
    await overview.click()
    await page.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(overview).toHaveAttribute('aria-current', 'page')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`contextual-${width}.png`),
      fullPage: true,
    })
    await page.goto(fixture('/dashboard?tab=progress&source=direct'))
    await page.reload()
    await expect(overview).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('img', { name: /^Personal weight history chart/ }),
    ).toBeVisible()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/dashboard?tab=progress&source=direct',
    )
    await expect(
      page.getByText('Other member private note must never render'),
    ).toHaveCount(0)
    await page.goto(fixture('/dashboard?tab=overview#personal-history'))
    await expect(page.getByTestId('fixture-route')).toHaveText('/weigh-ins')
    await expect(
      sections.getByRole('link', { name: 'Weigh-ins' }),
    ).toHaveAttribute('aria-current', 'page')
  })
}

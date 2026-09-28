import { expect, test } from '@playwright/test'

// Vite's dev-server SPA fallback serves the React shell for directory URLs.
// Address the static file explicitly here; Vercel serves /design-preview/ from
// this same index.html, as verified on the PR Preview deployment.
const previewUrl =
  process.env.DESIGN_PREVIEW_URL ?? '/design-preview/index.html'

test.describe('standalone design preview', () => {
  test('serves a labeled concept and navigable group screen', async ({
    page,
  }) => {
    const response = await page.goto(previewUrl)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle('Slimpossible · Screen concepts')
    await expect(
      page.getByRole('note', { name: 'Design concept notice' }),
    ).toContainText('not implemented')
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.getByRole('tab', { name: 'Group' }).click()
    await expect(
      page.getByRole('heading', { name: 'Progress together' }),
    ).toBeVisible()
    const table = page.locator('#panel-group table')
    await expect(
      table.getByRole('columnheader', { name: 'Member' }),
    ).toBeVisible()
    await expect(
      table.getByRole('columnheader', { name: 'Your note' }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Show earlier sample entries' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Hide earlier sample entries' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  test('previews default dual sharing and privacy changes without saving', async ({
    page,
  }) => {
    await page.goto(previewUrl)
    await page.getByRole('tab', { name: 'Weigh-in' }).click()
    const personal = page.locator('#send-personal')
    const group = page.locator('#send-group')
    await expect(personal).toBeChecked()
    await expect(group).toBeChecked()
    await expect(page.getByTestId('scope-summary')).toContainText(
      'members can see',
    )
    await expect(
      page.getByRole('button', { name: 'Save weigh-in' }),
    ).toBeDisabled()
    await group.uncheck()
    await expect(page.getByTestId('scope-summary')).toContainText(
      'stay in your personal view',
    )
    await expect(page.locator('#scope-audience')).toHaveText('Only you')
    await personal.uncheck()
    await expect(
      page.getByRole('heading', { name: 'Choose at least one challenge' }),
    ).toBeVisible()
    await group.check()
    await expect(page.getByTestId('scope-summary')).toContainText(
      'Your note remains private',
    )
    await expect(page.locator('#scope-audience')).toHaveText(
      'You and group members',
    )
  })

  test('fits a narrow viewport and makes no off-origin requests', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const origins = new Set<string>()
    page.on('request', (request) => origins.add(new URL(request.url()).origin))
    await page.goto(previewUrl)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
    expect([...origins]).toEqual([new URL(page.url()).origin])
  })
})

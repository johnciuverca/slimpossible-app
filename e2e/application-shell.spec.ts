import { expect, test } from '@playwright/test'

test('keeps the application shell usable on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 375 })
  await page.goto('/')

  await expect(page.getByRole('banner')).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()

  await page.getByRole('link', { name: 'Today' }).click()
  await expect(page).toHaveURL(/\/today$/)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

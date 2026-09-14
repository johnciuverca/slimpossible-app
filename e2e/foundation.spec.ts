import { expect, test } from '@playwright/test'

test('opens the Slimpossible foundation screen', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('banner')).toContainText('Slimpossible')
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Your challenge starts here.' }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Tailwind is working')

  await page.getByRole('link', { name: 'Progress' }).click()
  await expect(page).toHaveURL(/\/progress$/)
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
})

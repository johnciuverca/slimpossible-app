import { expect, test } from '@playwright/test'

test('opens the Slimpossible foundation screen', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Your challenge starts here.' }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Tailwind is working')
})

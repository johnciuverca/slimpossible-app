import { expect, test } from '@playwright/test'

test('renders public client routes when loaded directly', async ({ page }) => {
  await page.goto('/milestones-preview')

  await expect(
    page.getByRole('heading', { name: 'Milestone progress preview' }),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toBeVisible()

  await page.goto('/weigh-ins')

  await expect(
    page.getByRole('heading', { name: 'Daily weigh-in.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('form', { name: 'Daily weigh-in form' }),
  ).toBeVisible()
})

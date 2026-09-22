import { expect, test } from '@playwright/test'

test('opens the public challenge setup flow from the home screen', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('banner')).toContainText('Slimpossible')
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Your challenge starts here.' }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Public preview')

  await page.getByRole('link', { name: 'Set up a challenge' }).click()
  await expect(page).toHaveURL(/\/challenge\/setup$/)
  await expect(
    page.getByRole('heading', { name: 'Set up your challenge.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('form', { name: 'Challenge setup form' }),
  ).toBeVisible()
})

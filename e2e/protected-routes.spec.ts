import { expect, test } from '@playwright/test'

test('redirects signed-out users from protected routes to public login', async ({
  page,
}) => {
  await page.goto('/progress?week=1#chart')

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
})

test('keeps login and registration navigation public', async ({ page }) => {
  await page.goto('/login')
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Create one' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(
    page.getByRole('heading', { name: 'Create your account.' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

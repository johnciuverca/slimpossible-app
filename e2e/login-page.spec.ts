import { expect, test } from '@playwright/test'

test('shows accessible login validation and local auth fallback', async ({
  page,
}) => {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Enter your email address.')).toBeVisible()
  await expect(page.getByText('Enter your password.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Email' }).fill('person@example.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
})

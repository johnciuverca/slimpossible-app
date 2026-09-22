import { expect, test } from '@playwright/test'

test('keeps password recovery public and validates it accessibly', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot your password?' }).click()

  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(
    page.getByRole('heading', { name: 'Reset your password' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Send recovery link' }).click()
  await expect(page.getByText('Enter your email address.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Email' }).fill('person@example.com')
  await page.getByRole('button', { name: 'Send recovery link' }).click()
  await expect(
    page
      .getByRole('form', { name: 'Password recovery form' })
      .getByText(
        'Remote authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      ),
  ).toBeVisible()
})

test('keeps the reset form unavailable without a valid recovery session', async ({
  page,
}) => {
  await page.goto('/reset-password?type=recovery')

  await expect(
    page.getByText(
      'This password recovery link is invalid or expired. Request a new link.',
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('form', { name: 'Reset password form' }),
  ).toHaveCount(0)
})

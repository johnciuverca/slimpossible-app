import { expect, test } from '@playwright/test'

test('shows accessible registration validation and local fallback', async ({
  page,
}) => {
  await page.goto('/register')

  await expect(
    page.getByRole('heading', { name: 'Create your account.' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(page.getByText('Confirm your password.')).toBeVisible()

  await page.getByLabel('Full name').fill('Participant')
  await page.getByRole('textbox', { name: 'Email' }).fill('person@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByLabel('Confirm password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(
    page.getByRole('alert', {
      name: 'Remote registration is not configured in this local preview yet.',
    }),
  ).toBeVisible()
})

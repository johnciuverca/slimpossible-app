import { expect, test } from '@playwright/test'

test('Profile changes password with accessible reveal controls and keeps secrets out of the URL', async ({
  page,
}) => {
  await page.goto('/e2e/fixtures/profile-harness.html')
  await page.getByText('Fixture Alex', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await page.getByRole('button', { name: 'Change password' }).click()

  const currentPassword = page.getByLabel('Current password', { exact: true })
  await currentPassword.fill('Fixture-current-8')
  await page.getByRole('button', { name: 'Show current password' }).click()
  await expect(currentPassword).toHaveAttribute('type', 'text')
  await page
    .getByLabel('New password', { exact: true })
    .fill('Fixture-new-password-8')
  await page
    .getByLabel('Confirm new password', { exact: true })
    .fill('Fixture-new-password-8')
  await page.getByRole('button', { name: 'Update password' }).click()

  await expect(page.getByRole('status')).toHaveText('Password updated.')
  await expect(page).toHaveURL(/\/e2e\/fixtures\/profile-harness\.html$/)
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Fixture-new-password-8',
  )
})

import { expect, test } from '@playwright/test'

test('edits the Profile username and restores it on reload using a synthetic gateway', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e/fixtures/profile-harness.html')
  await page.getByText('Fixture Alex', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  const username = page.getByLabel('Username', { exact: true })
  await expect(username).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Edit username', exact: true }).click()
  await expect(username).toBeFocused()
  await expect(username).toHaveAttribute('placeholder', 'name or nickname')
  await username.fill('Unsaved nickname')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(username).toHaveValue('Fixture Alex')
  await expect(username).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Edit username', exact: true }).click()
  await username.fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(username).toHaveAccessibleDescription(
    'Enter your username or nickname.',
  )
  await username.fill('  Mobile nickname  ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Username saved.')
  await expect(username).toHaveValue('Mobile nickname')
  await expect(username).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Close Profile' }).click()
  await expect(page.getByText('Mobile nickname', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Mobile nickname', { exact: true })).toBeVisible()
  await page.getByText('Mobile nickname', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(
    'Mobile nickname',
  )
})

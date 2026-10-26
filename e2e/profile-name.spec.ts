import { expect, test } from '@playwright/test'

test('Profile email stays plain text beside the matching pencil until edited', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e/fixtures/profile-harness.html')
  await page.getByText('Fixture Alex', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()

  const email = page.getByText('fixture@example.invalid', { exact: true })
  const usernameEdit = page.getByRole('button', {
    name: 'Edit username',
    exact: true,
  })
  const emailEdit = page.getByRole('button', {
    name: 'Edit email address',
    exact: true,
  })
  const emailInput = page.getByLabel('New email address', { exact: true })

  await expect(email).toBeVisible()
  await expect(emailInput).toHaveCount(0)
  await expect(emailEdit).toHaveClass(await usernameEdit.getAttribute('class'))
  await emailEdit.click()
  await expect(emailInput).toBeFocused()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(email).toBeVisible()
  await expect(emailInput).toHaveCount(0)
})

test('edits the Profile username and restores it on reload using a synthetic gateway', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e/fixtures/profile-harness.html')
  await page.getByText('Fixture Alex', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  const username = page.getByLabel('Username', { exact: true })
  await expect(username).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit username', exact: true }).click()
  await expect(username).toBeFocused()
  await expect(username).toHaveAttribute('placeholder', 'name or nickname')
  await username.fill('Unsaved nickname')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByText('Fixture Alex', { exact: true }),
  ).toBeVisible()
  await expect(username).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit username', exact: true }).click()
  await username.fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(username).toHaveAccessibleDescription(
    'Enter your username or nickname.',
  )
  await username.fill('  Mobile nickname  ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Username saved.')
  await expect(
    page.getByRole('dialog').getByText('Mobile nickname', { exact: true }),
  ).toBeVisible()
  await expect(username).toHaveCount(0)
  await page.getByRole('button', { name: 'Close Profile' }).click()
  await expect(page.getByText('Mobile nickname', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Mobile nickname', { exact: true })).toBeVisible()
  await page.getByText('Mobile nickname', { exact: true }).click()
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByText('Mobile nickname', { exact: true }),
  ).toBeVisible()
  await expect(username).toHaveCount(0)
})

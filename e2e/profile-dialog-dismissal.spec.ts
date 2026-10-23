import { expect, test } from '@playwright/test'

test('Profile closes on outside click, stays open on inside click, and guards dirty drafts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e/fixtures/profile-harness.html')
  const account = page.getByLabel('Profile and account for Fixture Alex', {
    exact: true,
  })
  const openProfile = async () => {
    await account.click()
    await page.getByRole('button', { name: 'Profile', exact: true }).click()
    return page.getByRole('dialog', { name: 'Profile', exact: true })
  }

  let profile = await openProfile()
  await profile.getByRole('heading', { name: 'Profile' }).click()
  await expect(profile).toBeVisible()
  const profileBounds = await profile.boundingBox()
  expect(profileBounds).not.toBeNull()
  await page.mouse.click(profileBounds!.x + 6, profileBounds!.y + 6)
  await expect(profile).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(profile).toHaveCount(0)
  await expect(account).toBeFocused()

  profile = await openProfile()
  await profile.getByRole('button', { name: 'Edit username' }).click()
  const username = profile.getByLabel('Username', { exact: true })
  await username.fill('Unsaved draft')

  const askToDiscard = async () => {
    const confirmation = page.getByRole('dialog', {
      name: 'Discard unsaved input?',
    })
    await expect(confirmation).toBeVisible()
    await expect(username).toHaveValue('Unsaved draft')
    await confirmation.getByRole('button', { name: 'Stay' }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(profile).toBeVisible()
    await expect(username).toHaveValue('Unsaved draft')
  }

  await profile.getByRole('button', { name: 'Close Profile' }).click()
  await askToDiscard()

  await page.keyboard.press('Escape')
  await askToDiscard()

  await page.mouse.click(5, 5)
  const confirmation = page.getByRole('dialog', {
    name: 'Discard unsaved input?',
  })
  await expect(confirmation).toBeVisible()
  await expect(username).toHaveValue('Unsaved draft')
  await confirmation.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(profile).toHaveCount(0)
  await expect(account).toBeFocused()
})

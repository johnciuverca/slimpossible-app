import { expect, test } from '@playwright/test'

test('direct-loads and refreshes the signed-out Home welcome journey', async ({
  page,
}) => {
  await page.goto('/?challenge=not-visible-while-signed-out')

  await expect(page.getByRole('banner')).toContainText('Slimpossible')
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Keep showing up. It adds up.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Create your account' }),
  ).toHaveAttribute('href', '/register')
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(
    page.getByRole('link', { name: 'Set up a challenge' }),
  ).toHaveCount(0)

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Keep showing up. It adds up.' }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/?\?challenge=not-visible-while-signed-out$/)
})

test('activates sign-in from Home with the keyboard', async ({ page }) => {
  await page.goto('/')
  const signIn = page.getByRole('link', { name: 'Sign in' })
  await signIn.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
})

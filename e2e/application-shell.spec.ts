import { expect, test } from '@playwright/test'

test('keeps the application shell usable at 390px without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 390 })
  await page.goto('/')

  await expect(page.getByRole('banner')).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    page.getByRole('button', { name: 'Group history, coming soon' }),
  ).toBeDisabled()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390)

  await page.getByRole('link', { name: 'Today' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
})

test('shows all live destinations without horizontal overflow on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/')

  for (const label of [
    'Overview',
    'Today',
    'My progress',
    'Group',
    'Goals',
    'Weigh-in',
  ]) {
    await expect(page.getByRole('link', { name: label })).toBeVisible()
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(1440)
})

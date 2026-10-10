import { expect, test } from '@playwright/test'

const fixture = (scenario: 'member' | 'owner' | 'no-challenge' | 'progress') =>
  `/e2e/fixtures/today-harness.html?scenario=${scenario}`

test('renders only the signed-in member latest weigh-in and private note', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto(fixture('member'))

  await expect(page.getByText('E2E joined challenge · Active')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Your latest weigh-in' }),
  ).toBeVisible()
  await expect(page.getByText('88.4 kg')).toBeVisible()
  await expect(
    page.getByText('E2E private note for the signed-in participant.'),
  ).toBeVisible()
  await expect(
    page.getByText('A shared summary is not available in this data mode.'),
  ).toBeVisible()
  await expect(
    page.getByText('Other participant private note must not appear.'),
  ).toHaveCount(0)
  await expect(page.getByText('90 kg')).toHaveCount(0)
  await expect(page).toHaveURL(/today-harness\.html\?scenario=member$/)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390)

  await page.reload()
  await expect(page.getByText('88.4 kg')).toBeVisible()
  await expect(
    page.getByText('E2E private note for the signed-in participant.'),
  ).toBeVisible()

  const recordLink = page.getByRole('button', {
    name: 'Record weight',
    exact: true,
  })
  await recordLink.focus()
  await expect(recordLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Record weight' }),
  ).toBeVisible()
})

test('gives an owner without participation a working self-enrollment path', async ({
  page,
}) => {
  await page.goto(fixture('owner'))

  await expect(
    page.getByRole('heading', { name: 'You are not enrolled yet' }),
  ).toBeVisible()
  const enrollLink = page.getByRole('link', { name: 'Enroll yourself' })
  await expect(enrollLink).toHaveAttribute(
    'href',
    '/challenge/participants/enroll?challenge=e2e-challenge&self=owner',
  )
  await enrollLink.click()
  await expect(
    page.getByRole('heading', { name: 'Enroll a participant.' }),
  ).toBeVisible()
})

test('offers challenge setup when the signed-in account has no challenge', async ({
  page,
}) => {
  await page.goto(fixture('no-challenge'))

  await expect(
    page.getByRole('heading', { name: 'No challenge yet' }),
  ).toBeVisible()
  const setupLink = page.getByRole('link', { name: 'Set up a challenge' })
  await expect(setupLink).toHaveAttribute('href', '/challenge/setup')
  await setupLink.click()
  await expect(
    page.getByRole('heading', { name: 'Set up your challenge.' }),
  ).toBeVisible()
})

test('renders private, saved Progress records accessibly at a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto(fixture('progress'))

  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  await expect(page.getByText('88.4 kg', { exact: true })).toHaveCount(1)
  await expect(page.getByText('88.40 kg', { exact: true })).toHaveCount(1)
  await expect(page.getByText('−1.6 kg', { exact: true })).toHaveCount(2)
  await expect(
    page.getByText('E2E private note for the signed-in participant.'),
  ).toBeVisible()
  await expect(
    page.getByText('Other participant private note must not appear.'),
  ).toHaveCount(0)
  await expect(
    page.getByRole('img', { name: /2 saved weigh-ins/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toBeVisible()

  const groupHistory = page.getByRole('region', {
    name: 'Shared group weigh-ins',
  })
  await expect(groupHistory).toContainText('Opted-in dates and weights only')
  await expect(groupHistory).toContainText('Notes are never shown here')
  await expect(groupHistory).toContainText(
    'Shared group history is unavailable right now.',
  )
  await expect(groupHistory.getByRole('link')).toHaveCount(0)
  await expect(groupHistory.getByRole('button')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390)
})

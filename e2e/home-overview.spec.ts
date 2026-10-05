import { expect, test } from '@playwright/test'

const homeFixture = (scenario: string, selected?: string, route?: string) => {
  const params = new URLSearchParams({ scenario })
  if (selected) params.set('selected', selected)
  if (route) params.set('route', route)
  return `/e2e/fixtures/today-harness.html?${params.toString()}`
}

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`shows a joined member's saved Home overview on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await page.goto(homeFixture('home-member'))

    await expect(
      page.getByRole('heading', { name: 'Keep showing up. It adds up.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Your latest weigh-in' }),
    ).toBeVisible()
    await expect(page.getByText('88.4 kg', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Your snapshot' }),
    ).toBeVisible()
    await expect(page.getByText('Personal target progress')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /E2E joined challenge/ }),
    ).toHaveAttribute('aria-pressed', 'true')

    const actions = page.getByRole('navigation', {
      name: 'Selected challenge actions',
    })
    for (const [label, path] of [
      ['Today', '/today?challenge=e2e-challenge'],
      ['My progress', '/progress?challenge=e2e-challenge'],
      ['Group progress', '/group?challenge=e2e-challenge'],
      ['Goals', '/goals?challenge=e2e-challenge'],
      ['Record a weigh-in', '/weigh-ins?challenge=e2e-challenge'],
    ]) {
      await expect(actions.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        path,
      )
    }
    await expect(
      page.getByText('Other participant private note must not appear.'),
    ).toHaveCount(0)
    await expect(
      page.getByText('E2E private note for the signed-in participant.'),
    ).toHaveCount(0)
    await expect(page.getByText('Autumn Reset')).toHaveCount(0)
    await expect(page.getByText('91.8 kg')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)

    await page.reload()
    await expect(page.getByText('88.4 kg', { exact: true })).toBeVisible()
  })
}

test('keeps owner actions separate from member-only summaries', async ({
  page,
}) => {
  await page.goto(homeFixture('home-owner'))

  await expect(
    page.getByText('Enroll as a participant to see your personal entries.'),
  ).toBeVisible()
  const actions = page.getByRole('navigation', {
    name: 'Selected challenge actions',
  })
  await expect(
    actions.getByRole('link', { name: 'Enroll yourself' }),
  ).toHaveAttribute(
    'href',
    '/challenge/participants/enroll?challenge=e2e-challenge&self=owner',
  )
  await expect(
    actions.getByRole('link', { name: 'Invite participants' }),
  ).toHaveAttribute('href', '/challenge/invites?challenge=e2e-challenge')
  await expect(actions.getByRole('link', { name: 'Today' })).toHaveCount(0)
  await expect(
    actions.getByRole('link', { name: 'Group progress' }),
  ).toHaveCount(0)
  await expect(page.getByText('Weekly group comparison')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Set up another challenge' }),
  ).toHaveAttribute('href', '/challenge/setup')
})

test('keeps sign-in and no-challenge setup paths available', async ({
  page,
}) => {
  await page.goto(homeFixture('home-signed-out'))
  await expect(
    page.getByRole('heading', { name: 'Keep showing up. It adds up.' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login',
  )
  await expect(
    page.getByRole('link', { name: 'Create your account' }),
  ).toHaveAttribute('href', '/register')

  await page.goto(homeFixture('home-no-challenge'))
  await expect(
    page.getByText(/No saved challenge is available for this account yet/),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Set up a challenge' }),
  ).toHaveAttribute('href', '/challenge/setup')
  await expect(
    page.getByRole('navigation', { name: 'Selected challenge actions' }),
  ).toHaveCount(0)
})

test('challenge cards switch by keyboard and preserve a direct selection after refresh', async ({
  page,
}) => {
  await page.goto(homeFixture('home-member-multi'))

  const autumn = page.getByRole('button', { name: /E2E Autumn challenge/ })
  const winter = page.getByRole('button', { name: /E2E Winter challenge/ })
  await expect(autumn).toHaveAttribute('aria-pressed', 'true')
  await winter.focus()
  await page.keyboard.press('Enter')
  await expect(winter).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page
      .getByRole('navigation', { name: 'Selected challenge actions' })
      .getByRole('link', { name: 'Group progress' }),
  ).toHaveAttribute('href', '/group?challenge=e2e-challenge-2')
  const headerToday = page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Today' })
  await expect(headerToday).toHaveAttribute(
    'href',
    '/today?challenge=e2e-challenge-2',
  )
  await headerToday.click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('E2E Winter challenge · Active')).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Group history and saving to multiple challenges',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('You can switch between joined challenges from Overview.'),
  ).toBeVisible()
  await expect(
    page.getByText('Each weigh-in is saved to the selected challenge only.'),
  ).toBeVisible()

  await page.goto(homeFixture('home-member-multi', 'e2e-challenge-2'))
  await expect(
    page.getByRole('button', { name: /E2E Winter challenge/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(
    page.getByRole('button', { name: /E2E Winter challenge/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText('No weigh-ins are saved for this challenge yet.'),
  ).toBeVisible()
  await expect(page.getByText('88.4 kg', { exact: true })).toHaveCount(0)

  await page.goto(homeFixture('home-member-multi', 'e2e-challenge-2', '/today'))
  await expect(page.getByText('E2E Winter challenge · Active')).toBeVisible()
  await page.reload()
  await expect(page.getByText('E2E Winter challenge · Active')).toBeVisible()
})

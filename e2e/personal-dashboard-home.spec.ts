import { expect, test } from '@playwright/test'

const fixture = (scenario: string, path = '/dashboard') =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario, path })}`

for (const width of [1280, 390]) {
  test(`personal Dashboard aliases have no challenge tabs/cards and keep profile/history/actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [
      '/dashboard?challenge=dashboard-active',
      '/today?challenge=dashboard-active',
      '/',
    ]) {
      await page.goto(fixture('owned-many', path))
      await expect(
        page.getByRole('heading', { name: 'Dashboard', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('navigation', { name: 'Challenge contexts' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('list', { name: 'Separate challenge summaries' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: /^Challenge progress:/ }),
      ).toHaveCount(0)
      const profile = page.getByRole('region', { name: 'About you' })
      await expect(
        profile.getByText('Synthetic Alex', { exact: true }),
      ).toBeVisible()
      await expect(
        profile.getByText('user-alex@example.invalid', { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'My Progress and private history' }),
      ).toHaveAttribute('href', '/progress')
      await expect(
        page.getByRole('button', { name: 'Record weight', exact: true }),
      ).toBeEnabled()
      await expect(
        page.getByRole('link', { name: 'Create challenge', exact: true }),
      ).toHaveAttribute('href', '/challenge/setup')
      await expect(
        page
          .getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('link', { name: 'Challenges', exact: true }),
      ).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width)
    }
    await page
      .getByRole('link', { name: 'Create challenge', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Set up your challenge.' }),
    ).toBeVisible()
  })

  test(`Dashboard explains missing owned groups at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('zero-context'))
    await page
      .getByRole('button', { name: 'Invite people', exact: true })
      .click()
    await expect(page.getByText(/Create a group challenge first/)).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Continue to invitations' }),
    ).toHaveCount(0)

    expect(
      await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.challenge-invites') ?? '[]',
        ),
      ),
    ).toEqual([])
  })

  for (const scenario of ['owned-one', 'owned-many']) {
    test(`Dashboard uses the existing invite flow for ${scenario} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(fixture(scenario))
      let expectedId = 'dashboard-draft'
      if (scenario === 'owned-many') {
        const invite = page.getByRole('button', {
          name: 'Invite people',
          exact: true,
        })
        await invite.click()
        const chooser = page.getByRole('combobox', {
          name: 'Choose a group you own',
        })
        await expect(chooser).toHaveValue('')
        await expect(chooser.getByRole('option')).toHaveCount(3)
        await expect(
          chooser.getByRole('option', { name: 'Synthetic personal goal' }),
        ).toHaveCount(0)
        await expect(
          page.getByRole('link', { name: 'Continue to invitations' }),
        ).toHaveCount(0)
        await chooser.selectOption('dashboard-active')
        await expect(
          page.getByRole('link', { name: 'Continue to invitations' }),
        ).toHaveAttribute(
          'href',
          '/challenge/invites?challenge=dashboard-active',
        )
        await page
          .getByRole('button', { name: 'Switch synthetic account' })
          .click()
        await expect(chooser).toHaveCount(0)
        await expect(
          page.getByRole('link', { name: 'Continue to invitations' }),
        ).toHaveCount(0)
        await expect(
          page
            .getByRole('region', { name: 'About you' })
            .getByText('Synthetic Second'),
        ).toBeVisible()
        await expect(
          page
            .getByRole('region', { name: 'About you' })
            .getByText('Synthetic Alex'),
        ).toHaveCount(0)
        await page
          .getByRole('button', { name: 'Switch synthetic account' })
          .click()
        await invite.click()
        await expect(chooser).toHaveValue('')
        await chooser.selectOption('dashboard-active')
        expectedId = 'dashboard-active'
        await page
          .getByRole('link', { name: 'Continue to invitations' })
          .click()
      } else {
        const invite = page.getByRole('link', {
          name: 'Invite people',
          exact: true,
        })
        await expect(invite).toHaveAttribute(
          'href',
          '/challenge/invites?challenge=dashboard-draft',
        )
        await invite.focus()
        await page.keyboard.press('Enter')
      }
      await expect(
        page.getByRole('heading', { name: 'Invite participants.' }),
      ).toBeVisible()
      await expect(
        page.getByRole('combobox', { name: 'Challenge', exact: true }),
      ).toHaveValue(expectedId)
      await expect(
        page.getByRole('button', { name: 'Create invite link', exact: true }),
      ).toBeEnabled()
      expect(
        await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem('slimpossible.local.challenge-invites') ??
              '[]',
          ),
        ),
      ).toEqual([])
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width)
    })
  }
}

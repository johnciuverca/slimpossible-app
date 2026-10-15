import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

for (const width of [1280, 390]) {
  test(`authorized goal choices keep personal history separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/dashboard?challenge=unavailable'))
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    const goals = page.getByRole('navigation', { name: 'Your goal challenges' })
    const primary = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(contexts).toHaveCount(0)

    await expect(
      page.getByText('This personal goal is unavailable for this account.', {
        exact: false,
      }),
    ).toBeVisible()
    await expect(
      goals.getByRole('link', { name: 'Synthetic active group', exact: true }),
    ).toHaveCount(0)
    await expect(
      goals.getByRole('link', { name: /Second account/ }),
    ).toHaveCount(0)
    const original = await page.evaluate(() =>
      localStorage.getItem('slimpossible.local.personal-weigh-ins'),
    )
    const last = goals.getByRole('link', {
      name: 'Authorized personal context 12',
      exact: true,
    })
    await last.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/dashboard?tab=progress&challenge=extra-11#goals',
    )
    await expect(last).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic first-account private note', { exact: true }),
    ).toBeVisible()
    const bounds = await goals.evaluate((nav) => {
      const outer = nav.getBoundingClientRect()
      const active = nav
        .querySelector('[aria-current="page"]')!
        .getBoundingClientRect()
      return {
        left: outer.left,
        right: outer.right,
        activeLeft: active.left,
        activeRight: active.right,
      }
    })
    expect(bounds.activeLeft).toBeGreaterThanOrEqual(bounds.left - 1)
    expect(bounds.activeRight).toBeLessThanOrEqual(bounds.right + 1)
    await primary.getByRole('link', { name: 'Group', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Group', exact: true }),
    ).toBeVisible()
    await primary.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')

    await goals
      .getByRole('link', { name: 'Synthetic personal goal', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/dashboard?tab=progress&challenge=dashboard-personal#goals',
    )
    for (const retired of ['Challenges', 'My progress', 'Goals'])
      await expect(
        primary.getByRole('link', { name: retired, exact: true }),
      ).toHaveCount(0)
    expect(
      await page.evaluate(() =>
        localStorage.getItem('slimpossible.local.personal-weigh-ins'),
      ),
    ).toBe(original)
    await page.goto(fixture('/progress?challenge=dashboard-personal'))
    await page.reload()
    await expect(
      goals.getByRole('link', { name: 'Synthetic personal goal', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })

  test(`Weigh-ins context never changes input/shares and leaving has Stay/Discard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/weigh-ins'))
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    const weight = page.getByLabel('Weight in kg')
    await expect(weight).toBeVisible()
    await weight.fill('83.2')
    await page
      .getByLabel('Private note (optional)')
      .fill('Unsaved author-only input')
    const draft = page.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    await draft.check()
    await contexts
      .getByRole('link', {
        name: 'Group · Synthetic active group',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/weigh-ins?challenge=dashboard-active',
    )
    await expect(weight).toHaveValue('83.2')
    await expect(draft).toBeChecked()
    await expect(
      page.getByRole('checkbox', {
        name: 'Synthetic active group',
        exact: true,
      }),
    ).not.toBeChecked()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await contexts
      .getByRole('link', { name: 'Personal tracking', exact: true })
      .click()
    await expect(draft).toBeChecked()
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Dashboard', exact: true })
      .click()
    const warning = page.getByRole('dialog', { name: 'Discard unsaved input?' })
    await expect(warning).toBeVisible()
    await expect(
      warning.getByRole('button', { name: 'Stay', exact: true }),
    ).toBeFocused()
    await warning.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(weight).toHaveValue('83.2')
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Dashboard', exact: true })
      .click()
    await warning
      .getByRole('button', { name: 'Discard and leave', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
    await page.goto(fixture('/weigh-ins'))
    await expect(weight).toHaveValue('')
    await expect(page.getByLabel('Private note (optional)')).toHaveValue('')
    await expect(draft).not.toBeChecked()
    await expect(
      page.getByText('Unsaved author-only input', { exact: true }),
    ).toHaveCount(0)
  })

  test(`account switching removes prior contexts and personal records at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/progress'))
    const contexts = page.getByRole('navigation', {
      name: 'Your goal challenges',
    })
    await expect(
      contexts.getByRole('link', { name: /Synthetic personal goal/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Switch synthetic account' }).click()
    await expect(
      contexts.getByRole('link', { name: /Synthetic personal goal/ }),
    ).toHaveCount(0)
    await expect(
      contexts.getByRole('link', {
        name: 'Second account goal',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic first-account private note', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Synthetic second-account private note', { exact: true }),
    ).toBeVisible()
  })
}

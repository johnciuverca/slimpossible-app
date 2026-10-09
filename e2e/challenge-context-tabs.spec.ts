import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

for (const width of [1280, 390]) {
  test(`authorized pills, distinct personal/challenge navigation and overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/dashboard?challenge=unavailable'))
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    const primary = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(contexts).toHaveCount(0)
    await primary
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    await expect(
      contexts.getByRole('link', { name: /Personal tracking/ }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      contexts.getByRole('link', {
        name: 'Group · Synthetic active group',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      contexts.getByRole('link', { name: /Second account/ }),
    ).toHaveCount(0)
    const original = await page.evaluate(() =>
      localStorage.getItem('slimpossible.local.personal-weigh-ins'),
    )
    const last = contexts.getByRole('link', {
      name: 'Personal · Authorized personal context 12',
      exact: true,
    })
    await last.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/progress?challenge=extra-11',
    )
    await expect(
      contexts.getByRole('link', { name: /Authorized personal context 12/ }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('heading', { name: 'Challenge progress', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Group dashboard' }),
    ).toHaveCount(0)
    const bounds = await contexts.evaluate((nav) => {
      const active = nav
        .querySelector('[aria-current="page"]')!
        .getBoundingClientRect()
      const row = nav.querySelector('div')!.getBoundingClientRect()
      return {
        activeLeft: active.left,
        activeRight: active.right,
        left: row.left,
        right: row.right,
        overflow:
          nav.querySelector('div')!.scrollWidth >
          nav.querySelector('div')!.clientWidth,
      }
    })
    expect(bounds.overflow).toBe(true)
    expect(bounds.activeLeft).toBeGreaterThanOrEqual(bounds.left - 1)
    expect(bounds.activeRight).toBeLessThanOrEqual(bounds.right + 1)
    await primary.getByRole('link', { name: 'Goals', exact: true }).click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/goals?challenge=extra-11',
    )
    await contexts
      .getByRole('link', {
        name: 'Group · Synthetic active group',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/goals?challenge=dashboard-active',
    )
    await primary.getByRole('link', { name: 'Group', exact: true }).click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/group?challenge=dashboard-active',
    )
    await expect(contexts.getByRole('link', { name: /Personal/ })).toHaveCount(
      0,
    )
    await primary
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/progress?challenge=dashboard-active',
    )
    await contexts
      .getByRole('link', {
        name: 'Personal · Synthetic personal goal',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/progress?challenge=dashboard-personal',
    )
    await primary.getByRole('link', { name: 'Challenges', exact: true }).click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/challenges?challenge=dashboard-personal',
    )
    await contexts
      .getByRole('link', {
        name: 'Group · Synthetic active group',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/challenges?challenge=dashboard-active',
    )
    await primary
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/progress?challenge=dashboard-active',
    )
    await contexts
      .getByRole('link', { name: 'Personal tracking', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText('/progress')
    await expect(
      page.getByText('Synthetic first-account private note', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() =>
        localStorage.getItem('slimpossible.local.personal-weigh-ins'),
      ),
    ).toBe(original)
    await page.goto(fixture('/progress?challenge=dashboard-personal'))
    await page.reload()
    await expect(
      contexts.getByRole('link', {
        name: /Personal · Synthetic personal goal/,
      }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(contexts.getByRole('combobox')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
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
      .getByRole('link', { name: 'Goals', exact: true })
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
      .getByRole('link', { name: 'Goals', exact: true })
      .click()
    await warning
      .getByRole('button', { name: 'Discard and leave', exact: true })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText('/goals')
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Weigh-in', exact: true })
      .click()
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
      name: 'Challenge contexts',
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
        name: 'Personal · Second account goal',
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

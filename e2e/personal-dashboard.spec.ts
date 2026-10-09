import { expect, test } from '@playwright/test'

const fixture = (scenario: string, path = '/dashboard') =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario, path })}`

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`personal Dashboard works with no challenge, native dialog keyboard/escape and /today compatibility on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(fixture('zero-context', '/today?challenge=unavailable'))
    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Not logged today', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => ({
        challenges: JSON.parse(
          localStorage.getItem('slimpossible.local.challenges') ?? '[]',
        ),
        participants: JSON.parse(
          localStorage.getItem('slimpossible.local.participants') ?? '[]',
        ),
      })),
    ).toEqual({ challenges: [], participants: [] })
    const record = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    await record.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', {
      name: 'Record weight',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Weight in kg')).toBeFocused()
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    if (viewport.label === 'mobile') {
      const rect = await dialog.boundingBox()
      expect(rect?.width).toBeCloseTo(viewport.width, 0)
      expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeCloseTo(900, 0)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(record).toBeFocused()
    await page.keyboard.press('Enter')
    await dialog.getByLabel('Weight in kg').fill('82.4')
    await dialog
      .getByLabel('Private note (optional)')
      .fill('Synthetic Dashboard private note')
    await dialog.getByLabel('Private note (optional)').focus()
    await page.keyboard.press('Tab')
    await expect(
      dialog.getByRole('button', { name: 'Save weight', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Logged today', { exact: true })).toBeVisible()
    await expect(record).toBeFocused()
    await expect(
      page.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Edit weight', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByText('82.4 kg', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Synthetic Dashboard private note', { exact: true }),
    ).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Logged today', { exact: true })).toBeVisible()
    await expect(page.getByText('82.4 kg', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'My Progress', exact: true }),
    ).toBeVisible()
    const table = page.getByRole('list', {
      name: 'Your saved personal weigh-ins',
    })
    await expect(
      table.getByText('Synthetic Dashboard private note', { exact: true }),
    ).toBeVisible()
    await expect(table.getByText('Private', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Personal weight history chart/ }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
    await page
      .getByRole('link', { name: 'Full weigh-in page', exact: true })
      .click()
    await expect(
      page
        .getByRole('list', { name: 'Personal weigh-in history' })
        .getByText(/82.4 kg/),
    ).toBeVisible()
  })

  test(`Dashboard/My Progress edit/delete reflect canonical trend and keep explicit sharing on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(fixture('groups'))
    await page
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    const draft = dialog.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    const active = dialog.getByRole('checkbox', {
      name: 'Synthetic active group',
      exact: true,
    })
    await expect(draft).not.toBeChecked()
    await expect(active).not.toBeChecked()
    await expect(
      dialog.getByRole('checkbox', { name: 'Synthetic personal goal' }),
    ).toHaveCount(0)
    await dialog.getByLabel('Weight in kg').fill('90')
    await draft.check()
    await active.check()
    await dialog
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await expect(page.getByText('90 kg', { exact: true })).toBeVisible()
    const goal = page.getByRole('progressbar', {
      name: 'Synthetic personal goal completion',
    })
    await expect(goal).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    await expect(draft).toBeChecked()
    await expect(active).toBeChecked()
    await dialog.getByLabel('Weight in kg').fill('85')
    await dialog
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    await expect(page.getByText('85 kg', { exact: true })).toBeVisible()
    await expect(goal).toHaveCount(0)
    const rows = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].sharedChallengeIds).toEqual([
      'dashboard-draft',
      'dashboard-active',
    ])

    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    const table = page.getByRole('list', {
      name: 'Your saved personal weigh-ins',
    })
    await expect(
      table.getByText(
        'Shared with Synthetic draft group, Synthetic active group',
        { exact: true },
      ),
    ).toBeVisible()
    const date = rows[0].date as string
    await table
      .getByRole('button', { name: `Edit weight ${date}`, exact: true })
      .click()
    await expect(draft).toBeChecked()
    await dialog.getByLabel('Weight in kg').fill('84')
    await dialog
      .getByLabel('Private note (optional)')
      .fill('Synthetic My Progress private correction')
    await dialog
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    await expect(table.getByText('84 kg', { exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: /84 kilograms/ })).toBeVisible()
    await page
      .getByRole('link', {
        name: 'Challenge progress: Synthetic personal goal',
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Challenge progress', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('link', { name: 'Back to My Progress', exact: true })
      .click()
    await expect(table.getByText('84 kg', { exact: true })).toBeVisible()
    await table
      .getByRole('button', { name: `Delete ${date}`, exact: true })
      .click()
    const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
    await expect(deletion).toContainText('ALL shared groups')
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(table.getByText('84 kg', { exact: true })).toBeVisible()
    await table
      .getByRole('button', { name: `Delete ${date}`, exact: true })
      .click()
    await deletion
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(page.getByText(/No personal entries yet/)).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Personal weight history chart/ }),
    ).toHaveCount(0)
    await page
      .getByRole('link', { name: 'Back to Dashboard', exact: true })
      .click()
    await expect(
      page.getByText('Not logged today', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('No record yet', { exact: true })).toBeVisible()
    await expect(goal).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('No record yet', { exact: true })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
  })

  test(`My Progress isolates synthetic accounts and Dashboard does not show private notes on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(fixture('accounts', '/progress'))
    const table = page.getByRole('list', {
      name: 'Your saved personal weigh-ins',
    })
    await expect(
      table.getByText('Synthetic first-account private note', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic second-account private note', { exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Switch synthetic account', exact: true })
      .click()
    await expect(
      table.getByText('Synthetic second-account private note', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic first-account private note', { exact: true }),
    ).toHaveCount(0)
    await expect(table.getByText('75 kg', { exact: true })).toBeVisible()
    await page
      .getByRole('link', { name: 'Back to Dashboard', exact: true })
      .click()
    await expect(page.getByText('75 kg', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Synthetic second-account private note', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Not logged today', { exact: true }),
    ).toBeVisible()
  })
}

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
    if (viewport.label === 'desktop')
      await expect(dialog.getByLabel('Weight in kg')).toBeFocused()
    else {
      await expect(dialog).toBeFocused()
      await dialog.getByRole('button', { name: /Private note/ }).click()
    }
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
    if (viewport.label === 'mobile')
      await dialog.getByRole('button', { name: /Private note/ }).click()
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
    await expect(
      page.getByText('82.4 kg', { exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic Dashboard private note', { exact: true }),
    ).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Logged today', { exact: true })).toBeVisible()
    await expect(
      page.getByText('82.4 kg', { exact: true }).first(),
    ).toBeVisible()

    await expect(
      page.getByRole('heading', { name: 'Dashboard', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    await expect(
      history.getByText('Synthetic Dashboard private note', { exact: true }),
    ).toBeVisible()
    await expect(history.getByText('Private', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Personal weight history chart/ }),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(
      page.getByRole('img', { name: /Personal weight history chart/ }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
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
    await expect(page.getByText('90 kg', { exact: true }).first()).toBeVisible()
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
    await expect(page.getByText('85 kg', { exact: true }).first()).toBeVisible()
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
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    const editDraft = page.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    await expect(
      history.getByText(
        'Shared with Synthetic draft group, Synthetic active group',
        { exact: true },
      ),
    ).toBeVisible()
    const date = rows[0].date as string
    await history
      .getByRole('button', { name: `Edit weight ${date}`, exact: true })
      .click()
    await expect(editDraft).toBeChecked()
    await page.getByLabel('Weight in kg').fill('84')
    await page
      .getByLabel('Private note (optional)')
      .fill('Synthetic My Progress private correction')
    await page
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    await expect(history.getByText('84 kg', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(page.getByRole('img', { name: /84 kilograms/ })).toBeVisible()
    await page
      .getByRole('link', {
        name: 'Synthetic personal goal',
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Goals', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('img', { name: /84 kilograms/ })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    await history
      .getByRole('button', { name: `Delete ${date}`, exact: true })
      .click()
    const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
    await expect(deletion).toContainText('ALL shared groups')
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(history.getByText('84 kg', { exact: true })).toBeVisible()
    await history
      .getByRole('button', { name: `Delete ${date}`, exact: true })
      .click()
    await deletion
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(page.getByText('No saved weigh-ins yet.')).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(
      page.getByRole('img', { name: /Personal weight history chart/ }),
    ).toHaveCount(0)

    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
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

  test(`Combined Dashboard shows only the active author's private history on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(fixture('accounts', '/progress'))
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    await expect(
      history.getByText('Synthetic first-account private note', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic second-account private note', { exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Switch synthetic account', exact: true })
      .click()
    await expect(
      history.getByText('Synthetic second-account private note', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic first-account private note', { exact: true }),
    ).toHaveCount(0)
    await expect(history.getByText('75 kg', { exact: true })).toBeVisible()

    await expect(page.getByText('75 kg', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText('Synthetic second-account private note', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(
      page.getByText('Not logged today', { exact: true }),
    ).toBeVisible()
  })
}

test('Dashboard chart opens edit/create drafts and only an explicit save records an estimate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(fixture('groups'))
  const offset = (date: string, days: number) => {
    const value = new Date(`${date}T00:00:00.000Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }

  await page.getByRole('button', { name: 'Record weight', exact: true }).click()
  const firstDialog = page.getByRole('dialog', { name: 'Record weight' })
  const today = (await firstDialog.getByLabel('Date').getAttribute('max'))!
  const firstDate = offset(today, -4)
  const estimateDate = offset(today, -2)
  await firstDialog.getByLabel('Date').fill(firstDate)
  await firstDialog.getByLabel('Weight in kg').fill('90')
  await firstDialog.getByRole('button', { name: 'Save weight' }).click()

  await page.getByRole('button', { name: 'Record weight', exact: true }).click()
  const secondDialog = page.getByRole('dialog', { name: 'Record weight' })
  await secondDialog.getByLabel('Weight in kg').fill('88.5')
  await secondDialog.getByRole('button', { name: 'Save weight' }).click()

  const chart = page.getByRole('img', { name: /Personal weight history chart/ })
  const actual = chart.locator(
    `circle[data-date="${firstDate}"][data-point-kind="recorded"]`,
  )
  await expect(actual).toBeVisible()
  await actual.click()
  const actualDetails = page.getByRole('group', {
    name: /Chart point details/,
  })
  await expect(actualDetails).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await actualDetails
    .getByRole('button', { name: 'Edit weight', exact: true })
    .click()
  const edit = page.getByRole('dialog', { name: 'Edit weight' })
  await expect(edit.getByLabel('Date')).toHaveValue(firstDate)
  await expect(edit.getByLabel('Weight in kg')).toHaveValue('90')
  await edit.getByRole('button', { name: 'Close' }).click()
  await expect(edit).toHaveCount(0)

  const estimate = chart.locator(
    `circle[data-date="${estimateDate}"][data-point-kind="estimated"]`,
  )
  await estimate.click()
  const estimateDetails = page.getByRole('group', {
    name: /Chart point details/,
  })
  await expect(estimateDetails).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await estimateDetails
    .getByRole('button', { name: 'Record weight', exact: true })
    .click()
  const create = page.getByRole('dialog', { name: 'Record weight' })
  await expect(create.getByLabel('Date')).toHaveValue(estimateDate)
  await expect(create.getByLabel('Weight in kg')).toHaveValue('89.25')
  await expect(create.getByText(/display-only estimate/)).toBeVisible()
  expect(
    await create
      .getByRole('checkbox')
      .evaluateAll((boxes) =>
        boxes.every((box) => !(box as HTMLInputElement).checked),
      ),
  ).toBe(true)
  await create.getByRole('button', { name: 'Close' }).click()
  await expect(create).toHaveCount(0)
  await expect(estimate).toBeVisible()

  await estimate.click()
  await expect(estimateDetails).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await estimateDetails
    .getByRole('button', { name: 'Record weight', exact: true })
    .click()
  const confirmedCreate = page.getByRole('dialog', { name: 'Record weight' })
  await confirmedCreate.getByRole('button', { name: 'Save weight' }).click()
  await expect(confirmedCreate).toHaveCount(0)
  await expect(
    chart.locator(
      `circle[data-date="${estimateDate}"][data-point-kind="recorded"]`,
    ),
  ).toBeVisible()
  await expect(
    chart.locator(
      `circle[data-date="${estimateDate}"][data-point-kind="estimated"]`,
    ),
  ).toHaveCount(0)
  const entries = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
    ),
  )
  expect(entries).toHaveLength(3)
  expect(
    entries.find((entry: { date: string }) => entry.date === estimateDate)
      .sharedChallengeIds,
  ).toEqual([])
})

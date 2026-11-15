import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'zero-context', path })}`

for (const surface of ['dashboard', 'weigh-ins'] as const) {
  test(`phone decimal input saves comma and dot values and edits them on ${surface}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(
      fixture(surface === 'dashboard' ? '/dashboard' : '/weigh-ins'),
    )

    const openEditor = async () => {
      if (surface === 'dashboard') {
        await page
          .getByRole('button', { name: 'Record weight', exact: true })
          .click()
        return page.getByRole('dialog')
      }
      return page.getByRole('form', { name: 'Personal weigh-in form' })
    }
    const editor = await openEditor()
    const weight = editor.getByLabel('Weight in kg')
    await expect(weight).toHaveAttribute('type', 'text')
    await expect(weight).toHaveAttribute('inputmode', 'decimal')
    expect(
      await weight.evaluate((input) =>
        Number.parseFloat(getComputedStyle(input).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16)
    await weight.fill('89,')
    await expect(weight).toHaveValue('89,')
    await weight.fill('89,5')
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()

    const created = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ),
    )
    expect(created).toHaveLength(1)
    expect(created[0].weightKg).toBe(89.5)

    if (surface === 'dashboard') {
      await page
        .getByRole('button', { name: 'Record weight', exact: true })
        .click()
    } else {
      const date = await page
        .getByRole('list', { name: 'Personal weigh-in history' })
        .locator('time')
        .first()
        .getAttribute('datetime')
      await page.getByRole('button', { name: `Edit weight ${date}` }).click()
    }
    const edit = surface === 'dashboard' ? page.getByRole('dialog') : editor
    const editWeight = edit.getByLabel('Weight in kg')
    await expect(editWeight).toHaveValue('89.5')
    await editWeight.fill('90.25')
    await edit
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    const updated = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ),
    )
    expect(updated).toHaveLength(1)
    expect(updated[0].weightKg).toBe(90.25)
  })
}

test('phone decimal input rejects mixed separators without changing saved data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture('/dashboard'))
  await page.getByRole('button', { name: 'Record weight', exact: true }).click()
  const editor = page.getByRole('dialog')
  const weight = editor.getByLabel('Weight in kg')
  await weight.fill('89,5.2')
  await editor.getByRole('button', { name: 'Save weight', exact: true }).click()
  await expect(editor).toBeVisible()
  await expect(weight).toHaveAttribute('aria-invalid', 'true')
  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ),
    ),
  ).toEqual([])
})

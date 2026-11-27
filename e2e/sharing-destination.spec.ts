import { expect, test } from '@playwright/test'

const fixture = (path: string, single = false) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'groups', path, ...(single ? { groupCount: '1' } : {}) })}`

for (const width of [320, 390, 430, 1440]) {
  test(`sharing choices precede private note and preserve multi-group edits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/dashboard'))
    const record = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    await record.click()
    let editor = page.getByRole('dialog', { name: 'Record weight' })
    await expect(
      editor.getByRole('status', { name: 'Sharing destination' }),
    ).toHaveCount(0)
    for (const checkbox of await editor.getByRole('checkbox').all())
      await expect(checkbox).not.toBeChecked()
    const fields = (await editor
      .locator('.record-weight-fields')
      .boundingBox())!
    const sharing = (await editor.locator('fieldset').boundingBox())!
    const note = await editor
      .locator('#personal-weigh-in-note-content')
      .evaluate(
        (el) =>
          el.previousElementSibling?.getBoundingClientRect().toJSON() ??
          el.getBoundingClientRect().toJSON(),
      )
    if (width < 768)
      expect(sharing.y + sharing.height).toBeLessThanOrEqual(note.y)
    else
      expect(sharing.y + sharing.height).toBeLessThanOrEqual(
        (await editor.getByLabel('Private note (optional)').boundingBox())!.y,
      )
    expect(fields.y + fields.height).toBeLessThanOrEqual(sharing.y)
    await editor.getByLabel('Weight in kg').fill('82.3')
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await expect(editor).toHaveCount(0)
    await record.click()
    editor = page.getByRole('dialog', { name: 'Edit weight' })
    for (const checkbox of await editor.getByRole('checkbox').all())
      await expect(checkbox).not.toBeChecked()
    await editor
      .getByRole('checkbox', { name: 'Synthetic active group', exact: true })
      .check()
    await editor
      .getByRole('checkbox', { name: 'Synthetic draft group', exact: true })
      .check()
    await editor
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    await expect(editor).toHaveCount(0)
    await record.click()
    editor = page.getByRole('dialog', { name: 'Edit weight' })
    for (const checkbox of await editor.getByRole('checkbox').all())
      await expect(checkbox).toBeChecked()
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true)
    for (const name of ['Update weight', 'Cancel edit']) {
      const box = (await editor
        .getByRole('button', { name, exact: true })
        .boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 33)
      expect(box.y + box.height).toBeLessThanOrEqual(900)
    }
    await page.screenshot({
      path: test.info().outputPath(`sharing-${width}.png`),
    })
  })
}

for (const path of ['/dashboard', '/weigh-ins']) {
  test(`single group defaults once and persisted private edits stay private on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (
          key === 'slimpossible.local.personal-weigh-ins' &&
          sessionStorage.getItem('fail-next-save') === 'yes'
        ) {
          sessionStorage.removeItem('fail-next-save')
          throw new Error('Synthetic save failure')
        }
        return original.call(this, key, value)
      }
    })
    await page.goto(fixture(path, true))
    const record = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    if (path === '/dashboard') await record.click()
    let editor = page.getByRole('form', { name: 'Personal weigh-in form' })
    let group = editor.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    await expect(group).toBeChecked()
    await group.uncheck()
    await editor.getByLabel('Weight in kg').fill('82.3')
    await expect(group).not.toBeChecked()
    await page.evaluate(() => sessionStorage.setItem('fail-next-save', 'yes'))
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(group).not.toBeChecked()
    await editor.getByLabel('Weight in kg').fill('82.4')
    await expect(group).not.toBeChecked()
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    if (path === '/dashboard')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    await record.click()
    editor = page.getByRole('form', { name: 'Personal weigh-in form' })
    group = editor.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('82.4')
    await expect(group).not.toBeChecked()
    const rows = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ),
    )
    expect(rows).toEqual([expect.objectContaining({ sharedChallengeIds: [] })])
  })
}

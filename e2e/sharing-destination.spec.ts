import { expect, test, type Locator } from '@playwright/test'

const fixture = (path: string, single = false) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'groups', path, ...(single ? { groupCount: '1' } : {}) })}`

async function expectCenteredActions(editor: Locator) {
  const row = (await editor.locator('.record-weight-actions').boundingBox())!
  const buttons = await editor.locator('.record-weight-actions button').all()
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()))
  expect(boxes.length).toBeGreaterThan(0)
  expect(boxes.every(Boolean)).toBe(true)
  expect(boxes.every((box) => Math.abs(box!.y - boxes[0]!.y) < 1)).toBe(true)
  const groupCenter = (boxes[0]!.x + boxes.at(-1)!.x + boxes.at(-1)!.width) / 2
  expect(groupCenter).toBeCloseTo(row.x + row.width / 2, 0)
}

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
    await expect(
      editor.getByRole('group', { name: 'Share record with groups' }),
    ).toBeVisible()
    await expectCenteredActions(editor)
    const [date, weight, sharing, note] = await Promise.all(
      [
        '.record-weight-date-field',
        '.record-weight-weight-field',
        '.record-weight-sharing-field',
        '.record-weight-note-field',
      ].map(
        async (selector) => (await editor.locator(selector).boundingBox())!,
      ),
    )
    if (width < 360) {
      expect(date.y + date.height).toBeLessThanOrEqual(weight.y)
      expect(weight.y + weight.height).toBeLessThanOrEqual(sharing.y)
      expect(sharing.y + sharing.height).toBeLessThanOrEqual(note.y)
    } else {
      expect(date.x + date.width).toBeLessThanOrEqual(weight.x)
      expect(sharing.x).toBeCloseTo(date.x, 1)
      expect(sharing.width).toBeCloseTo(date.width, 1)
      expect(note.x).toBeCloseTo(weight.x, 1)
      expect(note.width).toBeCloseTo(weight.width, 1)
      expect(date.y).toBeCloseTo(weight.y, 1)
      expect(sharing.y).toBeCloseTo(note.y, 1)
      expect(sharing.y).toBeGreaterThan(date.y)
    }
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
    await expectCenteredActions(editor)
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

for (const width of [320, 390, 430, 1440]) {
  test(`inline Record/Edit fields follow the compact labeled layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/weigh-ins'))
    const editor = page.getByRole('form', { name: 'Personal weigh-in form' })
    await expect(
      editor.getByRole('group', { name: 'Share record with groups' }),
    ).toBeVisible()
    await expectCenteredActions(editor)

    const [date, weight, sharing, note] = await Promise.all(
      [
        '.record-weight-date-field',
        '.record-weight-weight-field',
        '.record-weight-sharing-field',
        '.record-weight-note-field',
      ].map(
        async (selector) => (await editor.locator(selector).boundingBox())!,
      ),
    )
    if (width < 360) {
      expect(date.y + date.height).toBeLessThanOrEqual(weight.y)
      expect(weight.y + weight.height).toBeLessThanOrEqual(sharing.y)
      expect(sharing.y + sharing.height).toBeLessThanOrEqual(note.y)
    } else {
      expect(date.x + date.width).toBeLessThanOrEqual(weight.x)
      expect(sharing.x).toBeCloseTo(date.x, 1)
      expect(sharing.width).toBeCloseTo(date.width, 1)
      expect(note.x).toBeCloseTo(weight.x, 1)
      expect(note.width).toBeCloseTo(weight.width, 1)
      expect(date.y).toBeCloseTo(weight.y, 1)
      expect(sharing.y).toBeCloseTo(note.y, 1)
      expect(sharing.y).toBeGreaterThan(date.y)
    }
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true)
    await editor.getByLabel('Weight in kg').fill('82.3')
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await page
      .getByRole('button', { name: /^Edit weight/ })
      .first()
      .click()
    const editForm = page.getByRole('form', { name: 'Personal weigh-in form' })
    await expect(
      editForm.getByRole('button', { name: 'Update weight', exact: true }),
    ).toBeVisible()
    await expectCenteredActions(editForm)
    await page.screenshot({
      path: test.info().outputPath(`inline-editor-${width}.png`),
    })
  })
}

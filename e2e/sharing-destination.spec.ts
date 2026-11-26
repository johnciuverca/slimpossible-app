import { expect, test } from '@playwright/test'

for (const width of [320, 390, 430, 1440]) {
  test(`sharing destination follows explicit choices and saved edits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(
      '/e2e/fixtures/personal-dashboard-harness.html?scenario=groups&path=/dashboard',
    )
    const record = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    await record.click()
    let editor = page.getByRole('dialog', { name: 'Record weight' })
    let summary = editor.getByRole('status', { name: 'Sharing destination' })
    await expect(summary).toHaveText('Private — only you')
    for (const checkbox of await editor.getByRole('checkbox').all())
      await expect(checkbox).not.toBeChecked()
    let save = editor.getByRole('button', { name: 'Save weight', exact: true })
    await expect(save).toHaveAccessibleDescription('Private — only you')
    await editor.getByLabel('Weight in kg').fill('82.3')
    await save.click()
    await expect(editor).toHaveCount(0)
    const savedRows = () =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
        ),
      )
    expect(await savedRows()).toEqual([
      expect.objectContaining({ sharedChallengeIds: [] }),
    ])

    await record.click()
    editor = page.getByRole('dialog', { name: 'Edit weight' })
    summary = editor.getByRole('status', { name: 'Sharing destination' })
    save = editor.getByRole('button', { name: 'Update weight', exact: true })
    await expect(summary).toHaveText('Private — only you')
    await editor
      .getByRole('checkbox', { name: 'Synthetic active group', exact: true })
      .check()
    await expect(summary).toHaveText(
      'Sharing with: Synthetic active group · Note stays private',
    )
    await editor
      .getByRole('checkbox', { name: 'Synthetic draft group', exact: true })
      .check()
    await expect(summary).toContainText(
      'Synthetic draft group, Synthetic active group',
    )
    await save.click()
    await expect(editor).toHaveCount(0)
    expect((await savedRows())[0].sharedChallengeIds).toEqual([
      'dashboard-active',
      'dashboard-draft',
    ])

    await record.click()
    editor = page.getByRole('dialog', { name: 'Edit weight' })
    summary = editor.getByRole('status', { name: 'Sharing destination' })
    await expect(summary).toContainText(
      'Synthetic draft group, Synthetic active group',
    )
    for (const checkbox of await editor.getByRole('checkbox').all())
      await expect(checkbox).toBeChecked()
    const bounds = await summary.boundingBox()
    const actions = await editor.locator('.record-weight-actions').boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(actions!.x)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      actions!.x + actions!.width + 1,
    )
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true)
    for (const name of ['Update weight', 'Cancel edit']) {
      const box = await editor
        .getByRole('button', { name, exact: true })
        .boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 33)
      expect(box!.y + box!.height).toBeLessThanOrEqual(900)
    }
    await page.screenshot({
      path: test.info().outputPath(`sharing-${width}.png`),
    })
    await editor
      .getByRole('checkbox', { name: 'Synthetic active group', exact: true })
      .uncheck()
    await expect(summary).toContainText('Synthetic draft group')
    await expect(summary).not.toContainText('Synthetic active group')
    await editor
      .getByRole('checkbox', { name: 'Synthetic draft group', exact: true })
      .uncheck()
    await expect(summary).toHaveText('Private — only you')
    await editor
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    expect((await savedRows())[0].sharedChallengeIds).toEqual([])
  })
}

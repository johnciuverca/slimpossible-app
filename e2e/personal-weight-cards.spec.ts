import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`Weigh-ins cards, keyboard edit focus and confirmed deletion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto(
      `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'accounts', path: '/weigh-ins' })}`,
    )
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    await expect(history.getByText('90 kg', { exact: true })).toBeVisible()
    await expect(history.getByText('Private', { exact: true })).toBeVisible()
    await expect(
      history.getByText('Synthetic first-account private note', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Synthetic second-account private note', {
        exact: true,
      }),
    ).toHaveCount(0)
    const date = await history.locator('time').getAttribute('datetime')
    await expect(history.locator('time').first()).toHaveText(
      `${date!.slice(8, 10)}.${date!.slice(5, 7)}.${date!.slice(0, 4)}`,
    )
    const edit = history.getByRole('button', {
      name: `Edit weight ${date}`,
      exact: true,
    })
    const remove = history.getByRole('button', {
      name: `Delete ${date}`,
      exact: true,
    })
    const row = edit.locator('xpath=../../..')
    const dateLabel = row.locator('[data-record-date]')
    const value = row.locator('[data-personal-record-value]')
    const rowBox = (await row.boundingBox())!
    const dateBox = (await dateLabel.boundingBox())!
    const valueBox = (await value.boundingBox())!
    const editBox = (await edit.boundingBox())!
    const removeBox = (await remove.boundingBox())!
    expect(valueBox.x + valueBox.width / 2).toBeCloseTo(
      rowBox.x + rowBox.width / 2,
      1,
    )
    expect(valueBox.y + valueBox.height / 2).toBeCloseTo(
      editBox.y + editBox.height / 2,
      1,
    )
    expect(editBox.y + editBox.height / 2).toBeCloseTo(
      removeBox.y + removeBox.height / 2,
      1,
    )
    expect(dateBox.x + dateBox.width).toBeLessThanOrEqual(valueBox.x)
    expect(valueBox.x + valueBox.width).toBeLessThanOrEqual(editBox.x)
    expect(rowBox.height).toBeLessThanOrEqual(48)
    await expect(edit).toHaveAttribute(
      'title',
      `Edit weight: 90 kg recorded ${date}`,
    )
    await expect(remove).toHaveAttribute(
      'title',
      `Delete 90 kg recorded ${date}`,
    )
    for (const button of [edit, remove]) {
      const box = await button.boundingBox()
      const minimumTargetSize = width <= 600 ? 44 : 33
      expect(box!.width).toBeGreaterThanOrEqual(minimumTargetSize)
      expect(box!.height).toBeGreaterThanOrEqual(minimumTargetSize)
    }
    const weight = page.getByLabel('Weight in kg')
    await expect(weight).not.toBeFocused()
    await edit.focus()
    await page.keyboard.press('Enter')
    await expect(weight).toBeFocused()
    await expect(weight).toHaveValue('90')
    await expect(
      page.getByRole('heading', { name: 'Edit weigh-in', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Update weight', exact: true }),
    ).toBeVisible()
    const box = await weight.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(700)
    await page.getByRole('button', { name: 'Cancel edit', exact: true }).click()
    await remove.focus()
    await page.keyboard.press('Enter')
    {
      const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
      await expect(deletion).toContainText('ALL shared groups')
      await deletion
        .getByRole('button', { name: 'Cancel', exact: true })
        .click()
      await expect(remove).toBeFocused()
    }
    await expect(history.getByText('90 kg', { exact: true })).toBeVisible()
    await remove.focus()
    await page.keyboard.press('Enter')
    await page
      .getByRole('dialog', { name: 'Delete weight?' })
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(history).toHaveCount(0)
    await expect(page.getByText('No saved weigh-ins yet.')).toBeVisible()
    await page.reload()
    await expect(history).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  })
}

for (const width of [1280, 390]) {
  test(`centers a large recorded weight between the date and actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify([
          {
            id: 'synthetic-large-weight',
            userId: 'user-alex',
            date: '2026-11-18',
            weightKg: 123.45,
            note: '',
            sharedChallengeIds: [],
          },
        ]),
      )
    })
    await page.goto(
      `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'accounts', path: '/weigh-ins' })}`,
    )
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    const record = history.getByRole('listitem').filter({
      hasText: '123.45 kg',
    })
    const row = record.locator('[data-personal-weight-row]')
    const value = row.locator('[data-personal-record-value]')
    const valueBox = (await value.boundingBox())!
    const rowBox = (await row.boundingBox())!
    const edit = record.getByRole('button', { name: 'Edit weight 2026-11-18' })
    const remove = record.getByRole('button', { name: 'Delete 2026-11-18' })
    const editBox = (await edit.boundingBox())!
    const removeBox = (await remove.boundingBox())!
    await expect(value).toHaveClass(/text-3xl/)
    await expect(value).toHaveClass(/font-bold/)
    expect(valueBox.x + valueBox.width / 2).toBeCloseTo(
      rowBox.x + rowBox.width / 2,
      1,
    )
    expect(valueBox.x + valueBox.width).toBeLessThanOrEqual(editBox.x)
    expect(editBox.y + editBox.height / 2).toBeCloseTo(
      removeBox.y + removeBox.height / 2,
      1,
    )
    expect(rowBox.height).toBeLessThanOrEqual(48)
    await record.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: test.info().outputPath('large-personal-record-row.png'),
    })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  })
}

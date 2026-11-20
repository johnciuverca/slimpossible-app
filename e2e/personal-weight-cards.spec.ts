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
    const row = edit.locator(
      'xpath=ancestor::li[@data-personal-weight-container]',
    )
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
    expect(rowBox.height).toBeLessThanOrEqual(80)
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

for (const layout of [
  { label: 'desktop', width: 1280, hasTouch: false },
  { label: 'phone', width: 390, hasTouch: false },
  { label: 'coarse-pointer phone', width: 390, hasTouch: true },
]) {
  test(`centers a large recorded weight between the date and actions on ${layout.label}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: layout.hasTouch,
      viewport: { width: layout.width, height: 700 },
    })
    try {
      const page = await context.newPage()
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
      const visibleValueBox = await value.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const bounds = range.getBoundingClientRect()
        return { x: bounds.left, width: bounds.width }
      })
      const rowBox = (await row.boundingBox())!
      const recordBox = (await record.boundingBox())!
      const date = record.locator('[data-record-date]')
      const dateBox = (await date.boundingBox())!
      const edit = record.getByRole('button', {
        name: 'Edit weight 2026-11-18',
      })
      const remove = record.getByRole('button', {
        name: 'Delete 2026-11-18',
      })
      const actions = row.locator('[data-record-actions]')
      const actionsBox = (await actions.boundingBox())!
      const editBox = (await edit.boundingBox())!
      const removeBox = (await remove.boundingBox())!
      const visibleText = await value.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const bounds = range.getBoundingClientRect()
        return bounds.left + bounds.width / 2
      })
      const containerCenter = recordBox.x + recordBox.width / 2
      await expect(value).toHaveClass(/text-3xl/)
      await expect(value).toHaveClass(/font-bold/)
      expect(Math.abs(visibleText - containerCenter)).toBeLessThanOrEqual(2)
      expect(visibleValueBox.x).toBeGreaterThanOrEqual(
        dateBox.x + dateBox.width,
      )
      expect(visibleValueBox.x + visibleValueBox.width).toBeLessThanOrEqual(
        editBox.x,
      )
      expect(editBox.y + editBox.height / 2).toBeCloseTo(
        removeBox.y + removeBox.height / 2,
        1,
      )
      expect(
        Math.abs(
          dateBox.x -
            recordBox.x -
            (recordBox.x + recordBox.width - (actionsBox.x + actionsBox.width)),
        ),
      ).toBeLessThanOrEqual(2)
      expect(rowBox.height).toBeLessThanOrEqual(76)
      expect(recordBox.height).toBeLessThanOrEqual(76)
      await record.scrollIntoViewIfNeeded()
      await page.screenshot({
        path: test.info().outputPath('large-personal-record-row.png'),
      })
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(layout.width)
    } finally {
      await context.close()
    }
  })
}

for (const layout of [
  { label: 'desktop', width: 1280 },
  { label: '390px phone', width: 390 },
]) {
  test(`centers actual values and actions across shared metadata on ${layout.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: 700 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify([
          {
            id: 'shared-vertical-center',
            userId: 'user-alex',
            date: '2026-11-18',
            weightKg: 89.75,
            note: '',
            sharedChallengeIds: ['dashboard-active'],
          },
          {
            id: 'private-vertical-center',
            userId: 'user-alex',
            date: '2026-11-17',
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
    const sharedRecord = history.getByRole('listitem').filter({
      hasText: '89.75 kg',
    })
    await expect(sharedRecord.getByText(/^Shared with/)).toBeVisible()
    const privateRecord = history.getByRole('listitem').filter({
      hasText: '123.45 kg',
    })
    await expect(
      privateRecord.getByText('Private', { exact: true }),
    ).toBeVisible()

    for (const record of [sharedRecord, privateRecord]) {
      const card = await record.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const value = element.querySelector('[data-personal-record-value]')!
        const range = document.createRange()
        range.selectNodeContents(value)
        const valueBounds = range.getBoundingClientRect()
        const actions = element
          .querySelector('[data-record-actions]')!
          .getBoundingClientRect()
        const buttons = Array.from(
          element.querySelectorAll('[data-record-actions] button'),
        ).map((button) => button.getBoundingClientRect())
        return {
          centerY: bounds.top + bounds.height / 2,
          primaryCenterY:
            (Math.min(valueBounds.top, actions.top) +
              Math.max(valueBounds.bottom, actions.bottom)) /
            2,
          valueCenterX: valueBounds.left + valueBounds.width / 2,
          centerX: bounds.left + bounds.width / 2,
          valueLeft: valueBounds.left,
          valueRight: valueBounds.right,
          actionsLeft: actions.left,
          actionsRight: actions.right,
          date: element
            .querySelector('[data-record-date]')!
            .getBoundingClientRect(),
          rightInset: bounds.right - actions.right,
          height: bounds.height,
          targetsArePresent: buttons.length === 2,
        }
      })
      expect(Math.abs(card.primaryCenterY - card.centerY)).toBeLessThanOrEqual(
        2,
      )
      expect(Math.abs(card.valueCenterX - card.centerX)).toBeLessThanOrEqual(2)
      expect(card.date.right).toBeLessThanOrEqual(card.valueLeft)
      expect(card.valueRight).toBeLessThanOrEqual(card.actionsLeft)
      expect(card.rightInset).toBeCloseTo(7, 0)
      expect(card.targetsArePresent).toBe(true)
      expect(card.height).toBeLessThanOrEqual(76)
    }
  })
}

for (const width of [1280, 390]) {
  test(`estimated weigh-in is a one-line row matching recorded height at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify([
          {
            id: 'estimate-start',
            userId: 'user-alex',
            date: '2026-11-17',
            weightKg: 90,
            note: '',
            sharedChallengeIds: [],
          },
          {
            id: 'estimate-end',
            userId: 'user-alex',
            date: '2026-11-19',
            weightKg: 88,
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
    const estimate = history.locator('[data-estimated-weigh-in]')
    const estimateRow = estimate.locator('[data-personal-weight-row]')
    const actual = history.getByRole('listitem').filter({ hasText: '90 kg' })
    const actualRow = actual.locator('[data-record-info]')
    const date = estimateRow.locator('[data-record-date]')
    const value = estimateRow.locator('[data-personal-estimated-value]')
    const action = estimateRow.locator('[data-record-actions]')
    const button = action.getByRole('button', {
      name: /Record estimated weight/,
    })
    const [
      estimateCardBox,
      estimateRowBox,
      actualCardBox,
      actualRowBox,
      dateBox,
      valueBox,
      actionBox,
      buttonBox,
    ] = await Promise.all([
      estimate.boundingBox(),
      estimateRow.boundingBox(),
      actual.boundingBox(),
      actualRow.boundingBox(),
      date.boundingBox(),
      value.boundingBox(),
      action.boundingBox(),
      button.boundingBox(),
    ])
    expect(estimateCardBox).not.toBeNull()
    expect(estimateRowBox).not.toBeNull()
    expect(actualCardBox).not.toBeNull()
    expect(actualRowBox).not.toBeNull()
    expect(dateBox).not.toBeNull()
    expect(valueBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    expect(buttonBox).not.toBeNull()
    expect(
      Math.abs(estimateCardBox!.height - actualCardBox!.height),
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(estimateRowBox!.height - actualRowBox!.height),
    ).toBeLessThanOrEqual(width > 600 ? 1 : 10)
    expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(valueBox!.x)
    expect(valueBox!.x + valueBox!.width).toBeLessThanOrEqual(actionBox!.x)
    expect(valueBox!.x + valueBox!.width / 2).toBeCloseTo(
      estimateRowBox!.x + estimateRowBox!.width / 2,
      1,
    )
    const leftInset = dateBox!.x - estimateCardBox!.x
    const rightInset =
      estimateCardBox!.x +
      estimateCardBox!.width -
      (buttonBox!.x + buttonBox!.width)
    expect(actionBox!.x + actionBox!.width).toBeCloseTo(
      buttonBox!.x + buttonBox!.width,
      1,
    )
    expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(2)
    expect(buttonBox!.height).toBeGreaterThanOrEqual(width <= 600 ? 44 : 32)
    expect(valueBox!.y + valueBox!.height).toBeLessThanOrEqual(
      estimateRowBox!.y + estimateRowBox!.height,
    )
    await expect(value).toContainText('Estimated')
    await estimate.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: test.info().outputPath('personal-estimated-row.png'),
    })
  })
}

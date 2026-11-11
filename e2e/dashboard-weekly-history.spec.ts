import { expect, test } from '@playwright/test'

for (const width of [320, 390, 430, 1280]) {
  test(`Dashboard weekly history preserves private editing and ranges at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const monday = new Date()
    monday.setUTCHours(0, 0, 0, 0)
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    const dateAt = (offset: number) =>
      new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10)
    const dates = [-21, -20, -14, -7, 0].map(dateAt)
    const rows = dates.map((date, index) => ({
      id: `weekly-own-${index}`,
      userId: 'user-alex',
      date,
      weightKg: [90, 88, 87, 86, 84][index],
      note: 'Private weekly fixture note',
      sharedChallengeIds: ['dashboard-active'],
    }))
    const outsider = {
      id: 'weekly-outsider',
      userId: 'synthetic-second',
      date: dateAt(1),
      weightKg: 200,
      note: 'Other account secret',
      sharedChallengeIds: [],
    }
    await page.addInitScript(
      (entries) =>
        localStorage.setItem(
          'slimpossible.local.personal-weigh-ins',
          JSON.stringify(entries),
        ),
      [...rows, outsider],
    )
    await page.goto(
      '/e2e/fixtures/personal-dashboard-harness.html?scenario=groups&path=/dashboard',
    )
    const chart = page.getByRole('img', {
      name: /Personal weight history chart/,
    })
    await expect(chart).toHaveAccessibleName(/5 saved weigh-ins/)
    await expect(
      chart.locator('[data-point-kind="weekly-summary"]'),
    ).toHaveCount(3)
    await expect(chart).not.toContainText('Other account secret')
    await expect(chart).not.toContainText('Private weekly fixture note')
    await expect(chart.locator('[data-value="200"]')).toHaveCount(0)
    const summary = chart.getByRole('button', {
      name: /Weekly average 89 kg.*2 recorded weigh-ins/,
    })
    await expect(summary).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-weekly-normal-${width}.png`),
      fullPage: true,
    })
    await summary.press('Enter')
    const collapse = page
      .getByRole('group', { name: 'Chart date range controls', exact: true })
      .getByRole('button', { name: 'Back to weekly averages' })
    await expect(collapse).toBeInViewport()
    const collapseBox = (await collapse.boundingBox())!
    expect(collapseBox.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 36)
    expect(collapseBox.x).toBeGreaterThanOrEqual(0)
    expect(collapseBox.x + collapseBox.width).toBeLessThanOrEqual(width)
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-weekly-expanded-${width}.png`),
      fullPage: true,
    })
    const original = chart.locator(
      `circle[data-point-kind="recorded"][data-date="${dates[0]}"]`,
    )
    await original.press('Enter')
    const edit = page.getByRole('dialog', { name: 'Edit weight', exact: true })
    await expect(edit.getByLabel('Date')).toHaveValue(dates[0])
    await edit
      .getByRole('button', { name: 'Close weight editor', exact: true })
      .click()
    expect(
      await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.personal-weigh-ins')!,
        ),
      ),
    ).toEqual([...rows, outsider])
    await collapse.click()
    await expect(summary).toBeFocused()
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-weekly-collapsed-${width}.png`),
      fullPage: true,
    })
    await summary.press('Enter')
    await original.press('Enter')
    await edit.getByLabel('Weight in kg').fill('91')
    await edit
      .getByRole('button', { name: 'Update weight', exact: true })
      .click()
    await expect(edit).toHaveCount(0)
    const changed = await page.evaluate(
      (id) =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.personal-weigh-ins')!,
        ).find((entry: { id: string }) => entry.id === id),
      rows[0].id,
    )
    expect(changed).toMatchObject({
      weightKg: 91,
      note: rows[0].note,
      sharedChallengeIds: ['dashboard-active'],
    })
    const restored = chart.getByRole('button', {
      name: /Weekly average 89.5 kg.*2 recorded weigh-ins/,
    })
    await expect(restored).toBeVisible()
    const estimate = chart.locator(
      `circle[data-point-kind="estimated"][data-date="${dateAt(-1)}"]`,
    )
    await estimate.press('Enter')
    const create = page.getByRole('dialog', {
      name: 'Record weight',
      exact: true,
    })
    await expect(create.getByLabel('Date')).toHaveValue(dateAt(-1))
    await create
      .getByRole('button', { name: 'Close weight editor', exact: true })
      .click()
    await expect(estimate).toHaveCount(1)
    await estimate.press('Enter')
    await create
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await expect(create).toHaveCount(0)
    await expect(
      chart.locator(
        `circle[data-point-kind="recorded"][data-date="${dateAt(-1)}"]`,
      ),
    ).toHaveCount(1)
    const saved = await page.evaluate(
      (date) =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.personal-weigh-ins')!,
        ).find(
          (entry: { date: string; userId: string }) =>
            entry.date === date && entry.userId === 'user-alex',
        ),
      dateAt(-1),
    )
    expect(saved.sharedChallengeIds).toEqual([])
    await expect(chart).toHaveAccessibleName(/6 saved weigh-ins/)
    const start = page.getByRole('slider', { name: 'Visible range start' })
    await start.press('ArrowRight')
    await expect(restored).toHaveAttribute('data-value', '89.5')
    await expect(restored).toHaveAttribute('data-date', dates[1])
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-weekly-range-${width}.png`),
      fullPage: true,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
  })
}

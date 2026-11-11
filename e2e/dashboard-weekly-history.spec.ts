import { expect, test } from '@playwright/test'

test('Dashboard weekly chart opens recorded and estimated editors on touch', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  })
  const page = await context.newPage()
  const monday = new Date()
  monday.setUTCHours(0, 0, 0, 0)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const dateAt = (offset: number) =>
    new Date(monday.getTime() + offset * 86400000).toISOString().slice(0, 10)
  const dates = [-21, -20, -14, -7, 0].map(dateAt)
  await page.addInitScript(
    (entries) =>
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify(entries),
      ),
    dates.map((date, index) => ({
      id: `touch-own-${index}`,
      userId: 'user-alex',
      date,
      weightKg: [90, 88, 87, 86, 84][index],
      note: 'Touch fixture private note',
      sharedChallengeIds: ['dashboard-active'],
    })),
  )
  await page.goto(
    '/e2e/fixtures/personal-dashboard-harness.html?scenario=groups&path=/dashboard',
  )
  const chart = page.getByRole('img', {
    name: /Personal weight history chart/,
  })
  const recent = chart.locator(
    `circle[data-point-kind="recorded"][data-date="${dates[4]}"]`,
  )
  const recentBox = (await recent.boundingBox())!
  await page.touchscreen.tap(
    recentBox.x + recentBox.width / 2,
    recentBox.y + recentBox.height / 2,
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const pointDetails = page.getByRole('group', {
    name: /Chart point details/,
  })
  await expect(pointDetails).toBeVisible()
  const chartBox = (await chart.boundingBox())!
  await page.touchscreen.tap(chartBox.x + 5, chartBox.y + 5)
  await expect(pointDetails).toHaveCount(0)
  const reopenedRecentBox = (await recent.boundingBox())!
  await page.touchscreen.tap(
    reopenedRecentBox.x + reopenedRecentBox.width / 2,
    reopenedRecentBox.y + reopenedRecentBox.height / 2,
  )
  const recentEditAction = page.getByRole('button', {
    name: 'Edit',
    exact: true,
  })
  const recentEditBox = (await recentEditAction.boundingBox())!
  expect(recentEditBox.height).toBeGreaterThanOrEqual(44)
  await page.touchscreen.tap(
    recentEditBox.x + recentEditBox.width / 2,
    recentEditBox.y + recentEditBox.height / 2,
  )
  const edit = page.getByRole('dialog', { name: 'Edit weight', exact: true })
  await expect(edit.getByLabel('Date')).toHaveValue(dates[4])
  await edit
    .getByRole('button', { name: 'Close weight editor', exact: true })
    .click()
  const summary = page
    .locator('circle[data-point-kind="weekly-summary"]')
    .first()
  const summaryBox = (await summary.boundingBox())!
  await page.touchscreen.tap(
    summaryBox.x + summaryBox.width / 2,
    summaryBox.y + summaryBox.height / 2,
  )
  const expandAction = page
    .getByRole('group', { name: /Chart point details/ })
    .getByRole('button', { name: 'Expand week', exact: true })
  await expect(expandAction).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const expandBox = (await expandAction.boundingBox())!
  await page.touchscreen.tap(
    expandBox.x + expandBox.width / 2,
    expandBox.y + expandBox.height / 2,
  )
  const historical = chart.locator(
    `circle[data-point-kind="recorded"][data-date="${dates[0]}"]`,
  )
  const historicalBox = (await historical.boundingBox())!
  await page.touchscreen.tap(
    historicalBox.x + historicalBox.width / 2,
    historicalBox.y + historicalBox.height / 2,
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const historicalEditAction = page.getByRole('button', {
    name: 'Edit',
    exact: true,
  })
  const historicalEditBox = (await historicalEditAction.boundingBox())!
  await page.touchscreen.tap(
    historicalEditBox.x + historicalEditBox.width / 2,
    historicalEditBox.y + historicalEditBox.height / 2,
  )
  const historicalEdit = page.getByRole('dialog', {
    name: 'Edit weight',
    exact: true,
  })
  await expect(historicalEdit.getByLabel('Date')).toHaveValue(dates[0])
  await historicalEdit
    .getByRole('button', { name: 'Close weight editor', exact: true })
    .click()
  const estimate = chart.locator(
    `circle[data-point-kind="estimated"][data-date="${dateAt(-1)}"]`,
  )
  const estimateBox = (await estimate.boundingBox())!
  await page.touchscreen.tap(
    estimateBox.x + estimateBox.width / 2,
    estimateBox.y + estimateBox.height / 2,
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const recordAction = page
    .getByRole('group', { name: /Chart point details/ })
    .getByRole('button', { name: 'Record weight', exact: true })
  const recordBox = (await recordAction.boundingBox())!
  await page.touchscreen.tap(
    recordBox.x + recordBox.width / 2,
    recordBox.y + recordBox.height / 2,
  )
  const create = page.getByRole('dialog', {
    name: 'Record weight',
    exact: true,
  })
  await expect(create.getByLabel('Date')).toHaveValue(dateAt(-1))
  await expect(create.getByLabel('Weight in kg')).not.toHaveValue('')
  await create
    .getByRole('button', { name: 'Close weight editor', exact: true })
    .click()
  await context.close()
})

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
    // Exercise the real Dashboard activation path with pointer clicks. The
    // personal points are adapted into a series before reaching the renderer.
    const recent = chart.locator(
      `circle[data-point-kind="recorded"][data-date="${dates[4]}"]`,
    )
    await recent.click()
    const editAction = page.getByRole('button', { name: 'Edit', exact: true })
    await expect(editAction).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(recent).toHaveAttribute('style', 'outline: none;')
    await expect(chart.locator('[data-point-highlight]')).toHaveCount(1)
    const editActionBox = (await editAction.boundingBox())!
    expect(editActionBox.height).toBeGreaterThanOrEqual(width < 640 ? 44 : 36)
    await editAction.click()
    const edit = page.getByRole('dialog', { name: 'Edit weight', exact: true })
    await expect(edit.getByLabel('Date')).toHaveValue(dates[4])
    await edit
      .getByRole('button', { name: 'Close weight editor', exact: true })
      .click()
    const recentEstimate = chart.locator(
      `circle[data-point-kind="estimated"][data-date="${dateAt(-1)}"]`,
    )
    await recentEstimate.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    const estimateCreate = page.getByRole('dialog', {
      name: 'Record weight',
      exact: true,
    })
    await expect(estimateCreate.getByLabel('Date')).toHaveValue(dateAt(-1))
    await estimateCreate
      .getByRole('button', { name: 'Close weight editor', exact: true })
      .click()
    const summary = chart.getByRole('button', {
      name: /Weekly average 89 kg.*2 recorded weigh-ins/,
    })
    await expect(summary).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-weekly-normal-${width}.png`),
      fullPage: true,
    })
    await summary.click()
    const expandWeek = page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Expand week', exact: true })
    await expect(expandWeek).toBeVisible()
    await expandWeek.click()
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
    await original.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
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
    await summary.click()
    await page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Expand week', exact: true })
      .click()
    await original.click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
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
    await estimate.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    const create = page.getByRole('dialog', {
      name: 'Record weight',
      exact: true,
    })
    await expect(create.getByLabel('Date')).toHaveValue(dateAt(-1))
    await create
      .getByRole('button', { name: 'Close weight editor', exact: true })
      .click()
    await expect(estimate).toHaveCount(1)
    await estimate.click()
    await page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
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

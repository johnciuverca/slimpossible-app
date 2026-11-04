import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'groups', path })}`

test('compact mobile Record weight keeps group choices and Save reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture('/dashboard'))
  await page.getByRole('button', { name: 'Record weight', exact: true }).click()

  let dialog = page.getByRole('dialog', { name: 'Record weight' })
  const date = dialog.getByLabel('Date')
  const weight = dialog.getByLabel('Weight in kg')
  await expect(date).toBeVisible()
  await expect(weight).toBeVisible()
  await expect(weight).not.toBeFocused()
  const [dateBox, weightBox] = await Promise.all([
    date.boundingBox(),
    weight.boundingBox(),
  ])
  const dateShell = dialog.locator('.record-weight-field-shell').nth(0)
  const weightShell = dialog.locator('.record-weight-field-shell').nth(1)
  const [dateShellBox, weightShellBox, noteBox, sharingBox, saveButton] =
    await Promise.all([
      dateShell.boundingBox(),
      weightShell.boundingBox(),
      dialog.getByRole('button', { name: /Private note/ }).boundingBox(),
      dialog.locator('fieldset').boundingBox(),
      dialog.getByRole('button', { name: 'Save weight', exact: true }),
    ])
  const [dateShellStyle, weightShellStyle] = await Promise.all([
    dateShell.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: style.height,
        radius: style.borderRadius,
        padding: style.padding,
      }
    }),
    weightShell.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: style.height,
        radius: style.borderRadius,
        padding: style.padding,
      }
    }),
  ])
  expect(dateBox).not.toBeNull()
  expect(weightBox).not.toBeNull()
  expect(dateShellBox).not.toBeNull()
  expect(weightShellBox).not.toBeNull()
  expect(noteBox).not.toBeNull()
  expect(sharingBox).not.toBeNull()
  expect(dateShellStyle).toEqual(weightShellStyle)
  expect(dateShellBox!.height).toBeCloseTo(weightShellBox!.height, 1)
  expect(dateBox!.x).toBeGreaterThanOrEqual(dateShellBox!.x)
  expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(
    dateShellBox!.x + dateShellBox!.width,
  )
  expect(weightBox!.x).toBeGreaterThanOrEqual(weightShellBox!.x)
  expect(weightBox!.x + weightBox!.width).toBeLessThanOrEqual(
    weightShellBox!.x + weightShellBox!.width,
  )
  expect(Math.abs(dateShellBox!.x - weightShellBox!.x)).toBeLessThan(1)
  expect(dateShellBox!.width).toBeCloseTo(weightShellBox!.width, 1)
  expect(dateShellBox!.x).toBeCloseTo(noteBox!.x, 1)
  expect(dateShellBox!.width).toBeCloseTo(noteBox!.width, 1)
  expect(dateShellBox!.x).toBeCloseTo(sharingBox!.x, 1)
  expect(dateShellBox!.width).toBeCloseTo(sharingBox!.width, 1)
  const actionBox = (await saveButton.boundingBox())!
  expect(actionBox.x).toBeCloseTo(dateShellBox!.x, 1)
  expect(Math.abs(dateBox!.x - weightBox!.x)).toBeLessThan(2)
  expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(weightBox!.y)
  await expect(date).toHaveAttribute('type', 'date')
  await date.focus()
  await expect(date).toBeFocused()
  await dialog.focus()

  const noteToggle = dialog.getByRole('button', { name: /Private note/ })
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(dialog.getByLabel('Private note (optional)')).not.toBeVisible()
  await expect(
    dialog.getByRole('checkbox', { name: 'Synthetic draft group' }),
  ).toBeVisible()
  const group = dialog.getByRole('checkbox', {
    name: 'Synthetic active group',
  })
  await expect(group).toBeVisible()
  await expect(group).not.toBeChecked()
  const groupLabel = dialog.getByText('Synthetic active group', { exact: true })
  const [groupBox, groupNameBox] = await Promise.all([
    group.boundingBox(),
    groupLabel.boundingBox(),
  ])
  expect(groupBox).not.toBeNull()
  expect(groupNameBox).not.toBeNull()
  expect(groupBox!.y + groupBox!.height / 2).toBeCloseTo(
    groupNameBox!.y + groupNameBox!.height / 2,
    0,
  )
  await groupLabel.click()
  await expect(group).toBeChecked()
  await group.uncheck()

  const save = dialog.getByRole('button', { name: 'Save weight', exact: true })
  await expect(save).toBeVisible()
  const saveBox = (await save.boundingBox())!
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(844)

  await noteToggle.click()
  await expect(
    dialog.getByText('Private note (optional)', { exact: true }),
  ).toBeVisible()
  await dialog
    .getByLabel('Private note (optional)')
    .fill('Private compact note')
  await weight.fill('82.3')
  await group.check()
  await save.click()
  await expect(dialog).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        htmlOverflow: document.documentElement.style.overflow,
        bodyPosition: document.body.style.position,
        bodyOverflow: document.body.style.overflow,
      })),
    )
    .toEqual({ htmlOverflow: '', bodyPosition: '', bodyOverflow: '' })

  await page.getByRole('button', { name: 'Record weight', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit weight' })
  const savedNoteToggle = dialog.getByRole('button', { name: /Private note/ })
  await expect(savedNoteToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(savedNoteToggle).toHaveAccessibleName('Private note (optional)')
  await savedNoteToggle.click()
  await expect(savedNoteToggle).toHaveAccessibleName('Private note (optional)')
  await expect(dialog.getByLabel('Private note (optional)')).toHaveValue(
    'Private compact note',
  )
  await expect(
    dialog.getByRole('checkbox', { name: 'Synthetic active group' }),
  ).toBeChecked()

  const update = dialog.getByRole('button', {
    name: 'Update weight',
    exact: true,
  })
  await dialog.getByLabel('Weight in kg').focus()
  await page.evaluate(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) throw new Error('VisualViewport is unavailable')
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      value: 400,
    })
    visualViewport.dispatchEvent(new Event('resize'))
  })
  await expect(update).toBeVisible()
  await expect
    .poll(() => dialog.evaluate((element) => element.style.bottom))
    .toBe('444px')
  const keyboardViewportSave = (await update.boundingBox())!
  expect(
    keyboardViewportSave.y + keyboardViewportSave.height,
  ).toBeLessThanOrEqual(400)
  await page.evaluate(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return
    delete (visualViewport as VisualViewport & { height?: number }).height
    visualViewport.dispatchEvent(new Event('resize'))
  })
})

test('mobile note stays expanded and focused through keyboard resize, and the sheet contains scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 520 })
  await page.goto(fixture('/dashboard'))
  await page.evaluate(() => {
    document.body.style.minHeight = '2400px'
    window.scrollTo(0, 240)
  })
  await page.getByRole('button', { name: 'Record weight', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Record weight' })
  const noteToggle = dialog.getByRole('button', { name: /Private note/ })
  const note = dialog.getByLabel('Private note (optional)')
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'false')
  await noteToggle.click()
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'true')
  await note.focus()
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('VisualViewport is unavailable')
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      value: 280,
    })
    viewport.dispatchEvent(new Event('resize'))
  })
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(note).toBeFocused()
  await note.fill('Draft survives the virtual keyboard resize')
  const save = dialog.getByRole('button', {
    name: 'Save weight',
    exact: true,
  })
  await save.scrollIntoViewIfNeeded()
  const keyboardSaveBox = (await save.boundingBox())!
  expect(keyboardSaveBox.y + keyboardSaveBox.height).toBeLessThanOrEqual(280)
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    delete (viewport as VisualViewport & { height?: number }).height
    viewport.dispatchEvent(new Event('resize'))
  })
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(note).toBeFocused()
  await expect(note).toHaveValue('Draft survives the virtual keyboard resize')

  const scrollState = await page.evaluate(() => ({
    htmlOverflow: document.documentElement.style.overflow,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    scrollY: window.scrollY,
  }))
  expect(scrollState.htmlOverflow).toBe('hidden')
  expect(scrollState.bodyPosition).toBe('fixed')
  const initialDialogScroll = await dialog.evaluate(
    (element) => element.scrollTop,
  )
  await page.mouse.move(200, 430)
  await page.mouse.wheel(0, 360)
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialDialogScroll)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollState.scrollY)
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const bottomDialogScroll = await dialog.evaluate(
    (element) => element.scrollTop,
  )
  await page.mouse.wheel(0, 360)
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollTop))
    .toBe(bottomDialogScroll)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollState.scrollY)
  await expect(save).toBeVisible()

  await noteToggle.click()
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(note).not.toBeVisible()
  await noteToggle.click()
  await expect(note).toHaveValue('Draft survives the virtual keyboard resize')

  await dialog.getByRole('button', { name: 'Close weight editor' }).click()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(dialog).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        htmlOverflow: document.documentElement.style.overflow,
        htmlOverscroll: document.documentElement.style.overscrollBehavior,
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyLeft: document.body.style.left,
        bodyRight: document.body.style.right,
        bodyWidth: document.body.style.width,
        bodyOverflow: document.body.style.overflow,
        bodyOverscroll: document.body.style.overscrollBehavior,
        bodyMinHeight: document.body.style.minHeight,
      })),
    )
    .toEqual({
      htmlOverflow: '',
      htmlOverscroll: '',
      bodyPosition: '',
      bodyTop: '',
      bodyLeft: '',
      bodyRight: '',
      bodyWidth: '',
      bodyOverflow: '',
      bodyOverscroll: '',
      bodyMinHeight: '2400px',
    })
  expect(await page.evaluate(() => window.scrollY)).toBe(
    Math.abs(Number.parseFloat(scrollState.bodyTop)),
  )
})

test('localized date and weight controls fit narrow, landscape, zoomed, and wide viewports', async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: 'ru-RU',
    viewport: { width: 320, height: 720 },
  })
  const page = await context.newPage()
  await page.goto(fixture('/dashboard'))
  expect(await page.evaluate(() => navigator.language)).toMatch(/^ru/)
  await page.getByRole('button', { name: 'Record weight', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Record weight' })
  const date = dialog.getByLabel('Date')
  const weight = dialog.getByLabel('Weight in kg')
  await date.fill('2025-11-03')

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 360, height: 720 },
    { width: 390, height: 844 },
    { width: 767, height: 390 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    const stacked = viewport.width < 768 || viewport.height <= 500
    await expect
      .poll(async () => {
        const [dateBox, weightBox] = await Promise.all([
          date.boundingBox(),
          weight.boundingBox(),
        ])
        if (!dateBox || !weightBox) return false
        return stacked
          ? dateBox.y + dateBox.height <= weightBox.y &&
              Math.abs(dateBox.x - weightBox.x) < 2
          : dateBox.x + dateBox.width <= weightBox.x
      })
      .toBe(true)
    const [dateBox, weightBox, dateRow, weightRow, dialogBox] =
      await Promise.all([
        date.boundingBox(),
        weight.boundingBox(),
        date.locator('xpath=../../..').boundingBox(),
        weight.locator('xpath=../../..').boundingBox(),
        dialog.boundingBox(),
      ])
    expect(dateBox).not.toBeNull()
    expect(weightBox).not.toBeNull()
    expect(dateRow).not.toBeNull()
    expect(weightRow).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    expect(dateBox!.x).toBeGreaterThanOrEqual(dateRow!.x)
    expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(
      dateRow!.x + dateRow!.width,
    )
    expect(weightBox!.x).toBeGreaterThanOrEqual(weightRow!.x)
    expect(weightBox!.x + weightBox!.width).toBeLessThanOrEqual(
      weightRow!.x + weightRow!.width,
    )
    expect(dateRow!.x).toBeGreaterThanOrEqual(dialogBox!.x)
    expect(weightRow!.x + weightRow!.width).toBeLessThanOrEqual(
      dialogBox!.x + dialogBox!.width,
    )

    if (stacked) {
      expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(weightBox!.y)
      expect(Math.abs(dateBox!.x - weightBox!.x)).toBeLessThan(2)
      await expect(
        dialog.getByRole('button', { name: /Private note/ }),
      ).toHaveAttribute('aria-expanded', 'false')
    } else {
      expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(weightBox!.x)
      expect(weightBox!.x - (dateBox!.x + dateBox!.width)).toBeGreaterThan(0)
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width)
  }

  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('VisualViewport is unavailable')
    Object.defineProperties(viewport, {
      width: { configurable: true, value: 512 },
      scale: { configurable: true, value: 2 },
    })
    viewport.dispatchEvent(new Event('resize'))
  })
  await expect(dialog).toHaveAttribute('data-compact-viewport', '')
  await expect(
    dialog.getByRole('button', { name: /Private note/ }),
  ).toHaveAttribute('aria-expanded', 'false')
  const [zoomedDateBox, zoomedWeightBox] = await Promise.all([
    date.boundingBox(),
    weight.boundingBox(),
  ])
  expect(zoomedDateBox!.y + zoomedDateBox!.height).toBeLessThanOrEqual(
    zoomedWeightBox!.y,
  )

  await page.setViewportSize({ width: 844, height: 390 })
  const noteToggle = dialog.getByRole('button', { name: /Private note/ })
  await expect(noteToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(
    dialog.getByRole('checkbox', { name: 'Synthetic active group' }),
  ).toBeVisible()

  const save = dialog.getByRole('button', { name: 'Save weight', exact: true })
  await page.getByLabel('Weight in kg').focus()
  await page.evaluate(() => {
    const viewport = window.visualViewport
    if (!viewport) throw new Error('VisualViewport is unavailable')
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      value: 180,
    })
    viewport.dispatchEvent(new Event('resize'))
  })
  await expect
    .poll(() => dialog.evaluate((element) => element.style.bottom))
    .toBe('210px')
  await save.scrollIntoViewIfNeeded()
  const saveBox = (await save.boundingBox())!
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(180)

  await context.close()
})

for (const width of [1280, 390]) {
  test(`shared recording action preserves today's canonical note and shares across pages at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const action = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    for (const path of [
      '/dashboard',
      '/challenges',
      '/progress',
      '/group',
      '/goals',
      '/weigh-ins',
    ]) {
      await page.goto(fixture(path))
      if (path.startsWith('/progress') || path.startsWith('/goals'))
        await page
          .getByRole('navigation', { name: 'Dashboard sections' })
          .getByRole('link', { name: 'Overview', exact: true })
          .click()
      await action.click()
      const emptyEditor =
        path === '/weigh-ins'
          ? page.getByRole('form', { name: 'Personal weigh-in form' })
          : page.getByRole('dialog', { name: 'Record weight' })
      await expect(emptyEditor.getByLabel('Weight in kg')).toHaveValue('')
      await expect(
        emptyEditor.getByRole('checkbox', {
          name: 'Synthetic draft group',
          exact: true,
        }),
      ).not.toBeChecked()
      await expect(
        emptyEditor.getByRole('checkbox', {
          name: 'Synthetic active group',
          exact: true,
        }),
      ).not.toBeChecked()
    }
    await page.goto(fixture('/dashboard'))
    await action.click()
    let editor = page.getByRole('dialog')
    await editor.getByLabel('Weight in kg').fill('90')
    if (width <= 600)
      await editor.getByRole('button', { name: /Private note/ }).click()
    await editor
      .getByLabel('Private note (optional)')
      .fill('Synthetic preserved note')
    await editor
      .getByRole('checkbox', { name: 'Synthetic draft group', exact: true })
      .check()
    await editor
      .getByRole('button', { name: 'Save weight', exact: true })
      .click()
    await expect(editor).toHaveCount(0)
    await expect(
      page.locator('.dashboard-save-confirmation[role="status"]'),
    ).toBeVisible()

    for (const path of [
      '/dashboard',
      '/challenges',
      '/progress',
      '/progress?challenge=dashboard-active',
      '/group?challenge=missing',
      '/goals?challenge=missing',
      '/weigh-ins',
    ]) {
      await page.goto(fixture(path))
      if (path.startsWith('/progress') || path.startsWith('/goals'))
        await page
          .getByRole('navigation', { name: 'Dashboard sections' })
          .getByRole('link', { name: 'Overview', exact: true })
          .click()
      await expect(action).toHaveCount(1)
      await expect(action).toBeEnabled()
      if (await page.locator('.group-workspace').count()) {
        const subnav = page.getByRole('navigation', { name: 'Group sections' })
        await expect(
          subnav.getByRole('button', { name: 'Record weight', exact: true }),
        ).toHaveCount(1)
        const actions = (await subnav
          .getByRole('group', { name: 'Group actions' })
          .boundingBox())!
        const actionBox = (await action.boundingBox())!
        const content = await page
          .locator('.app-shell-main')
          .evaluate((element) => {
            const rect = element.getBoundingClientRect(),
              style = getComputedStyle(element)
            return {
              left: rect.left + parseFloat(style.paddingLeft),
              right: rect.right - parseFloat(style.paddingRight),
            }
          })
        expect(actionBox.x).toBeGreaterThanOrEqual(content.left)
        expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
          content.right + 1,
        )
        expect(actions.x + actions.width).toBeCloseTo(content.right, 0)
      } else {
        const header = page.locator('[data-weight-page-header]')
        const heading = header.getByRole('heading', { level: 1 })
        const headerBox = (await header.boundingBox())!
        const actionBox = (await action.boundingBox())!
        const headingBox = (await heading.boundingBox())!
        if (await page.locator('.dashboard-workspace').count()) {
          await expect(
            page
              .locator('.dashboard-latest')
              .getByRole('button', { name: 'Record weight', exact: true }),
          ).toBeVisible()
          expect(actionBox.y).toBeGreaterThan(headingBox.y + headingBox.height)
          expect(actionBox.x).toBeGreaterThanOrEqual(headerBox.x)
          expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
            headerBox.x + headerBox.width + 1,
          )
        } else if (
          await header.getByRole('group', { name: 'Group actions' }).count()
        ) {
          const actionsBox = (await header
            .getByRole('group', { name: 'Group actions' })
            .boundingBox())!
          expect(actionBox.x).toBeGreaterThanOrEqual(actionsBox.x)
          expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(
            actionsBox.x + actionsBox.width,
          )
          if (width >= 1280)
            expect(Math.abs(actionBox.y - headerBox.y)).toBeLessThan(2)
          else
            expect(actionBox.y).toBeGreaterThan(
              headingBox.y + headingBox.height,
            )
        } else if (width > 600) {
          expect(
            Math.abs(
              actionBox.x + actionBox.width - headerBox.x - headerBox.width,
            ),
          ).toBeLessThan(2)
          expect(Math.abs(actionBox.y - headerBox.y)).toBeLessThan(2)
        } else {
          expect(actionBox.y).toBeGreaterThan(headingBox.y + headingBox.height)
          expect(Math.abs(actionBox.x - headerBox.x)).toBeLessThan(2)
        }
      }
      await action.click()
      editor =
        path === '/weigh-ins'
          ? page.getByRole('form', { name: 'Personal weigh-in form' })
          : page.getByRole('dialog', { name: 'Edit weight' })
      if (path === '/weigh-ins' || width > 600)
        await expect(editor.getByLabel('Weight in kg')).toBeFocused()
      else {
        await expect(editor).toBeFocused()
        await editor.getByRole('button', { name: /Private note/ }).click()
      }
      await expect(editor.getByLabel('Private note (optional)')).toHaveValue(
        'Synthetic preserved note',
      )
      await expect(
        editor.getByRole('checkbox', {
          name: 'Synthetic draft group',
          exact: true,
        }),
      ).toBeChecked()
      await expect(
        editor.getByRole('checkbox', {
          name: 'Synthetic active group',
          exact: true,
        }),
      ).not.toBeChecked()
      await editor.getByLabel('Weight in kg').fill('89')
      await editor
        .getByRole('button', { name: 'Update weight', exact: true })
        .click()
      const rows = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
        ),
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        weightKg: 89,
        note: 'Synthetic preserved note',
        sharedChallengeIds: ['dashboard-draft'],
      })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width)
    }
  })

  test(`full-page Record weight resumes unfinished draft at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(fixture('/weigh-ins'))
    const form = page.getByRole('form', { name: 'Personal weigh-in form' })
    await form.getByLabel('Weight in kg').fill('90')
    await form.getByRole('button', { name: 'Save weight', exact: true }).click()
    await expect(page.getByText('90 kg', { exact: true })).toBeVisible()
    await form.getByLabel('Weight in kg').fill('83.2')
    await form
      .getByLabel('Private note (optional)')
      .fill('Unfinished synthetic draft')
    await form
      .getByRole('checkbox', { name: 'Synthetic active group', exact: true })
      .check()
    await page
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    await expect(form.getByLabel('Weight in kg')).toBeFocused()
    await expect(form.getByLabel('Weight in kg')).toHaveValue('83.2')
    await expect(form.getByLabel('Private note (optional)')).toHaveValue(
      'Unfinished synthetic draft',
    )
    await expect(
      form.getByRole('checkbox', {
        name: 'Synthetic active group',
        exact: true,
      }),
    ).toBeChecked()
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Dashboard', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Discard unsaved input?' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(form.getByLabel('Private note (optional)')).toHaveValue(
      'Unfinished synthetic draft',
    )
  })
}

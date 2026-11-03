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
  expect(dateBox).not.toBeNull()
  expect(weightBox).not.toBeNull()
  expect(Math.abs(dateBox!.y - weightBox!.y)).toBeLessThan(2)

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

  await page.getByRole('button', { name: 'Record weight', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit weight' })
  const savedNoteToggle = dialog.getByRole('button', { name: /Private note/ })
  await expect(savedNoteToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(savedNoteToggle).toContainText('Saved note')
  await savedNoteToggle.click()
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

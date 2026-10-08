import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'groups', path })}`

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
      await expect(action).toHaveCount(1)
      await expect(action).toBeEnabled()
      const header = page.locator('[data-weight-page-header]')
      const heading = header.getByRole('heading', { level: 1 })
      const headerBox = (await header.boundingBox())!
      const actionBox = (await action.boundingBox())!
      const headingBox = (await heading.boundingBox())!
      if (width > 600) {
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
      await action.click()
      editor =
        path === '/weigh-ins'
          ? page.getByRole('form', { name: 'Personal weigh-in form' })
          : page.getByRole('dialog', { name: 'Edit weight' })
      await expect(editor.getByLabel('Weight in kg')).toBeFocused()
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
      await expect(
        page.getByText(
          /Personal weight saved\.|Personal weigh-in saved in this browser\./,
        ),
      ).toBeVisible()
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
      .getByRole('link', { name: 'Goals', exact: true })
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

import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`popup dismiss guards unsaved input and traps/returns focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await page.goto(
      '/e2e/fixtures/personal-dashboard-harness.html?scenario=accounts&path=/progress',
    )
    const history = page.getByRole('list', {
      name: 'Your saved personal weigh-ins',
    })
    const edit = history.getByRole('button', { name: /Edit weight/ })
    await edit.click()
    const editor = page.getByRole('dialog', {
      name: 'Edit weight',
      exact: true,
    })
    await expect(editor.getByLabel('Weight in kg')).toBeFocused()
    await expect(editor.getByLabel('Private note (optional)')).toHaveValue(
      'Synthetic first-account private note',
    )
    await editor.getByLabel('Weight in kg').fill('89')
    await page.keyboard.press('Escape')
    const discard = page.getByRole('dialog', { name: 'Discard unsaved input?' })
    await expect(
      discard.getByRole('button', { name: 'Stay', exact: true }),
    ).toBeFocused()
    await discard.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('89')
    await editor.getByRole('button', { name: 'Close weight editor' }).click()
    await discard.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(editor).toHaveCount(0)
    await expect(edit).toBeFocused()
    await expect(history.getByText('90 kg', { exact: true })).toBeVisible()
    await edit.click()
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('90')
    const close = editor.getByRole('button', { name: 'Close weight editor' })
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(
      editor.getByRole('button', { name: 'Cancel edit' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(edit).toBeFocused()
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Weigh-in', exact: true }),
    ).toHaveCount(0)
  })
}

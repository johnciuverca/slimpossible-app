import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  for (const path of ['/progress', '/weigh-ins']) {
    test(`record cards, keyboard edit focus and confirmed deletion ${path} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 })
      await page.goto(
        `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'accounts', path })}`,
      )
      const history = page.getByRole('list', {
        name:
          path === '/progress'
            ? 'Your saved personal weigh-ins'
            : 'Personal weigh-in history',
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
      const edit = history.getByRole('button', {
        name: `Edit ${date}`,
        exact: true,
      })
      const remove = history.getByRole('button', {
        name: `Delete ${date}`,
        exact: true,
      })
      await expect(edit).toHaveAttribute('title', `Edit 90 kg recorded ${date}`)
      await expect(remove).toHaveAttribute(
        'title',
        `Delete 90 kg recorded ${date}`,
      )
      for (const button of [edit, remove]) {
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      const weight = page.getByLabel('Weight in kg')
      if (path === '/weigh-ins') await expect(weight).not.toBeFocused()
      await edit.focus()
      await page.keyboard.press('Enter')
      await expect(weight).toBeFocused()
      await expect(weight).toHaveValue('90')
      if (path === '/progress') {
        await expect(
          page.getByRole('dialog', { name: 'Edit weight' }),
        ).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(edit).toBeFocused()
      } else {
        const box = await weight.boundingBox()
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.y + box!.height).toBeLessThanOrEqual(700)
        await page
          .getByRole('button', { name: 'Cancel edit', exact: true })
          .click()
      }
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain(`90 kg recorded ${date}`)
        await dialog.dismiss()
      })
      await remove.focus()
      await page.keyboard.press('Enter')
      await expect(history.getByText('90 kg', { exact: true })).toBeVisible()
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain(`90 kg recorded ${date}`)
        await dialog.accept()
      })
      await remove.focus()
      await page.keyboard.press('Enter')
      await expect(history).toHaveCount(0)
      await expect(
        page.getByText(
          path === '/progress'
            ? 'No entries saved yet.'
            : /No personal weigh-ins saved yet/,
        ),
      ).toBeVisible()
      await page.reload()
      await expect(history).toHaveCount(0)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    })
  }
}

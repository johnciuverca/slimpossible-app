import { expect, test } from '@playwright/test'

const weighInFixture =
  '/e2e/fixtures/weigh-in-harness.html?challenge=challenge-1'

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`supports private save, edit, keyboard use, and refresh on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await page.goto(weighInFixture)

    await expect(
      page.getByRole('heading', { name: 'Record a weigh-in' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Slimpossible 2026' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Only this selected challenge receives the weigh-in. No second destination is active.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Additional destination, coming soon',
      }),
    ).toBeDisabled()
    await expect(
      page.getByText(
        'Active members and the owner can see dates and weights you explicitly choose to share in a group challenge. They never see your private notes; unchecked entries stay private.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Back to today' }),
    ).toHaveAttribute('href', '/today?challenge=challenge-1')

    const note = page.getByLabel('Private note (optional)')
    const saveButton = page.getByRole('button', { name: 'Save weigh-in' })
    const shareWithGroup = page.getByRole('checkbox', {
      name: /Share this date and weight with this group’s active members and owner/,
    })
    await expect(shareWithGroup).not.toBeChecked()
    await page.getByLabel('Weight in kg').fill('91.8')
    await note.fill('Kept my routine and feel good.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(shareWithGroup).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(saveButton).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(
      page.getByText('Weigh-in created in local storage.'),
    ).toBeVisible()
    const savedList = page.getByRole('list', { name: 'Saved weigh-ins' })
    await expect(savedList.getByRole('listitem')).toHaveCount(1)
    await expect(
      savedList.getByText('Kept my routine and feel good.'),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)

    await page.reload()
    await expect(savedList.getByText('91.8 kg')).toBeVisible()
    await expect(
      savedList.getByText('Kept my routine and feel good.'),
    ).toBeVisible()

    const date = await page
      .getByLabel('Date', { exact: true })
      .getAttribute('max')
    expect(date).toBeTruthy()
    await page.getByRole('button', { name: `Edit ${date}` }).click()
    await page.getByLabel('Weight in kg').fill('91.4')
    await note.fill('Updated private check-in.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(shareWithGroup).toBeFocused()
    await page.keyboard.press('Tab')
    const updateButton = page.getByRole('button', { name: 'Update weigh-in' })
    await expect(updateButton).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(
      page.getByText('Weigh-in updated in local storage.'),
    ).toBeVisible()
    await expect(savedList.getByRole('listitem')).toHaveCount(1)
    await expect(savedList.getByText('91.4 kg')).toBeVisible()
    await expect(savedList.getByText('Updated private check-in.')).toBeVisible()
    await expect(savedList.getByText('91.8 kg')).toHaveCount(0)
  })
}

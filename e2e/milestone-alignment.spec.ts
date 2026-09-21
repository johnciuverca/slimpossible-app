import { expect, test, type Page } from '@playwright/test'

async function verifyMilestoneAlignment(
  page: Page,
  width: number,
  height: number,
) {
  await page.setViewportSize({ height, width })
  await page.goto('/milestones-preview')

  const progress = page.getByRole('progressbar', {
    name: 'Milestone progress: 50% complete',
  })
  await expect(progress).toBeVisible()

  const markers = page.locator('[data-milestone-marker]')
  const cards = page
    .getByRole('list', { name: 'Milestone status' })
    .getByRole('listitem')
  await expect(markers).toHaveCount(4)
  await expect(cards).toHaveCount(4)

  for (let index = 0; index < 4; index += 1) {
    const markerBox = await markers.nth(index).boundingBox()
    const cardBox = await cards.nth(index).boundingBox()
    expect(markerBox).not.toBeNull()
    expect(cardBox).not.toBeNull()
    if (!markerBox || !cardBox) continue

    expect(
      Math.abs(
        markerBox.x + markerBox.width / 2 - (cardBox.x + cardBox.width / 2),
      ),
    ).toBeLessThan(2)
  }

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
}

test('aligns milestone markers with cards on desktop', async ({ page }) => {
  await verifyMilestoneAlignment(page, 1280, 720)
})

test('aligns milestone markers with cards on mobile', async ({ page }) => {
  await verifyMilestoneAlignment(page, 375, 812)
})

import { expect, test, type Page } from '@playwright/test'

async function verifyEnrollmentLinkAtViewport(
  page: Page,
  width: number,
  height: number,
) {
  await page.setViewportSize({ height, width })
  await page.goto('/challenge/setup')

  const enrollmentLink = page.getByRole('link', {
    name: 'Enroll participants',
  })
  await expect(enrollmentLink).toBeVisible()

  const linkBox = await enrollmentLink.boundingBox()
  const cardBox = await page.locator('section > div').boundingBox()
  expect(linkBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  if (!linkBox || !cardBox) return

  expect(linkBox.width).toBeLessThan(cardBox.width / 2)

  const outsideX = linkBox.x + linkBox.width + 16
  expect(outsideX).toBeLessThan(cardBox.x + cardBox.width)
  await page.mouse.click(outsideX, linkBox.y + linkBox.height / 2)
  await expect(page).toHaveURL(/\/challenge\/setup$/)

  await enrollmentLink.focus()
  await expect(enrollmentLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/challenge\/participants\/enroll$/)
}

test('limits the enrollment hit area on desktop and preserves keyboard activation', async ({
  page,
}) => {
  await verifyEnrollmentLinkAtViewport(page, 1280, 720)
})

test('limits the enrollment hit area on mobile and preserves keyboard activation', async ({
  page,
}) => {
  await verifyEnrollmentLinkAtViewport(page, 375, 812)
})

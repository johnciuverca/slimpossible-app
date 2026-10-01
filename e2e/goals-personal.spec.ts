import { expect, test } from '@playwright/test'

const goalsFixture = (scenario: string) =>
  `/e2e/fixtures/today-harness.html?scenario=${scenario}`

async function verifyResponsiveGoal(
  page: import('@playwright/test').Page,
  width: number,
) {
  await page.setViewportSize({ height: 900, width })
  await page.goto(goalsFixture('goals'))

  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: 'Milestone progress: 30% complete' }),
  ).toBeVisible()
  await expect(page.getByText('92 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('88.4 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('65 kg', { exact: true })).toHaveCount(0)
  await expect(page.getByText('E2E private goal note.')).toHaveCount(0)

  const markers = page.locator('[data-milestone-marker]')
  const cards = page.locator('[data-milestone-card]')
  await expect(markers).toHaveCount(4)
  await expect(cards).toHaveCount(4)

  for (let index = 0; index < 4; index++) {
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

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}

test('renders participant-only goal metrics and aligns milestone cards on desktop', async ({
  page,
}) => {
  await verifyResponsiveGoal(page, 1280)
})

test('keeps participant goal metrics and milestone alignment responsive on mobile', async ({
  page,
}) => {
  await verifyResponsiveGoal(page, 390)
})

test('shows gain milestones and kg thresholds from the participant goal', async ({
  page,
}) => {
  await page.goto(goalsFixture('goals-gain'))

  await expect(
    page.getByRole('progressbar', { name: 'Milestone progress: 50% complete' }),
  ).toBeVisible()
  await expect(page.getByText('Weight-gain goal')).toBeVisible()
  await expect(page.getByText('72.5 kg')).toBeVisible()
  await expect(page.getByText('77.5 kg')).toBeVisible()
})

test('presents maintenance fluctuations without a loss/gain milestone scale', async ({
  page,
}) => {
  await page.goto(goalsFixture('goals-maintenance'))

  await expect(page.getByText('Maintenance goal')).toBeVisible()
  await expect(page.getByText('79.9 kg', { exact: true })).toBeVisible()
  await expect(
    page.getByText('0.1 kg from your maintenance target.'),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(
    page.getByRole('list', { name: 'Milestone status' }),
  ).toHaveCount(0)
})

test('caps progress after passing the target and shows no negative remaining weight', async ({
  page,
}) => {
  await page.goto(goalsFixture('goals-beyond'))

  await expect(
    page.getByRole('progressbar', {
      name: 'Milestone progress: 100% complete',
    }),
  ).toBeVisible()
  await expect(page.getByText('Target reached', { exact: true })).toBeVisible()
  await expect(page.getByText('5 kg beyond your target')).toBeVisible()
  await expect(page.getByText('-5 kg')).toHaveCount(0)
})

test('keeps first-weigh-in guidance and saved goal metrics when history is empty', async ({
  page,
}) => {
  await page.goto(goalsFixture('goals-empty'))

  await expect(
    page.getByText(
      'Record your first weigh-in to see progress toward your target.',
    ),
  ).toBeVisible()
  await expect(page.getByText('92 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('No weigh-in yet')).toBeVisible()
  await expect(page.getByText('80 kg', { exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
})

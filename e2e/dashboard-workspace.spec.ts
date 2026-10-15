import { expect, test } from '@playwright/test'
const fixture = (path = '/dashboard', native = false) =>
  `/e2e/fixtures/dashboard-workspace-harness.html?${new URLSearchParams({ path, ...(native ? { native: '1' } : {}) })}`

test('Combined Dashboard has one chart/table and keyboard history access at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture())
  await expect(page.getByText('Latest personal weight')).toBeVisible()
  await expect(page.getByText('60 kg', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByRole('tablist', { name: 'Dashboard views' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toHaveCount(1)
  await page
    .getByRole('link', { name: 'My Progress and private history' })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/dashboard#personal-history',
  )
  await expect(
    page.getByRole('heading', { name: 'Goals', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('4.8 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic private latest note')).toBeVisible()
  await expect(page.getByText('Peer secret must stay hidden')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Record weight', exact: true }),
  ).toHaveCount(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('dashboard-progress-390.png'),
    fullPage: true,
  })
})

test('starting-weight control keeps keyboard focus and guards dirty input', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?challenge=goal-one#goals'))
  const action = page.getByRole('button', {
    name: 'Edit starting weight',
    exact: true,
  })
  await action.focus()
  await page.keyboard.press('Enter')
  const input = page.getByLabel('Correct starting weight (kg)')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('100')
  await input.fill('110')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(input).toHaveValue('110')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(action).toBeFocused()
  await expect(page.getByText(/95 kg ·/)).toBeVisible()
})

test('a fake target save preserves the baseline, history and focus after refresh', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress&challenge=goal-one'))
  const action = page.getByRole('button', {
    name: 'Change target',
    exact: true,
  })
  await action.click()
  await expect(page.getByLabel('New target (kg)')).toBeFocused()
  await page.getByLabel('New target (kg)').fill('100')
  await page.getByRole('button', { name: 'Save target', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('below your original')
  await page.getByLabel('New target (kg)').fill('85')
  await page.getByRole('button', { name: 'Save target', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('9.8 kg', { exact: true })).toBeVisible()
  await expect(action).toBeFocused()
  expect(
    await page.evaluate(() => sessionStorage.getItem('synthetic.target-calls')),
  ).toBe('1')
  const member = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('slimpossible.local.participants')!).find(
      (row: { id: string }) => row.id === 'goal-one-self',
    ),
  )
  expect(member.startingWeightKg).toBe(100)
  expect(member.targetWeightKg).toBe(85)
  await expect(page.getByText(/95 kg ·/)).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('dashboard-progress-desktop.png'),
    fullPage: true,
  })
})

test('changing a reached target refreshes its achievement history through the fake RPC', async ({
  page,
}) => {
  await page.goto(
    `${fixture('/dashboard?tab=progress&challenge=goal-one')}&reached=1`,
  )
  await page
    .getByRole('button', {
      name: 'Target reached · Change target',
      exact: true,
    })
    .click()
  await page.getByLabel('New target (kg)').fill('85')
  await page.getByRole('button', { name: 'Save target', exact: true }).click()
  await expect(page.getByText(/90 kg ·/)).toBeVisible()
  await expect(page.getByText(/95 kg ·/)).toBeVisible()
  await expect(page.getByText('4 kg', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Change target', exact: true }),
  ).toBeFocused()
})

test('Legacy Progress direct-loads and refreshes; Back/Forward preserves history anchors', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress&challenge=goal-one'))
  await page.reload()
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toBeVisible()
  await expect(page.getByText('4.8 kg', { exact: true })).toBeVisible()
  await page.goto(fixture('/dashboard', true))
  await page
    .getByRole('link', { name: 'My Progress and private history' })
    .click()
  await page.evaluate(() => history.back())
  await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
  await page.evaluate(() => history.forward())
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toBeVisible()
})

test('Escape protects dirty input and restores focus when discarded', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress'))
  const action = page.getByRole('button', {
    name: 'Change target',
    exact: true,
  })
  await action.click()
  await page.getByLabel('New target (kg)').fill('85')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('New target (kg)')).toHaveValue('85')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(action).toBeFocused()
})

test('browser Back keeps dirty target input until an explicit discard', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard', true))
  await page
    .getByRole('link', { name: 'My Progress and private history' })
    .click()
  await page.getByRole('button', { name: 'Change target', exact: true }).click()
  await page.getByLabel('New target (kg)').fill('85')
  await page.evaluate(() => window.history.back())
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('New target (kg)')).toHaveValue('85')
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/dashboard#personal-history',
  )
  await expect(page).toHaveURL(/\/dashboard#personal-history$/)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => window.history.back())
  await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
})

test('discarding the browser Back warning completes the requested navigation', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard', true))
  await page
    .getByRole('link', { name: 'My Progress and private history' })
    .click()
  await page.getByRole('button', { name: 'Change target', exact: true }).click()
  await page.getByLabel('New target (kg)').fill('85')
  await page.evaluate(() => window.history.back())
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
})

test('account and goal switching keep personal history separate and use the invitation route', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress&challenge=goal-two'))
  await expect(page.getByText('Synthetic private latest note')).toBeVisible()
  await expect(
    page.getByText(/Record your first weigh-in to see milestone progress/),
  ).toBeVisible()
  await page
    .getByRole('link', { name: 'Synthetic first group', exact: true })
    .click()
  await expect(page.getByText('4.8 kg', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Switch synthetic account' }).click()
  await expect(page.getByText('Synthetic second account note')).toBeVisible()
  await expect(page.getByText('Synthetic private latest note')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Change target', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Join with invitation' }).click()
  await page
    .getByLabel('Invitation link or token')
    .fill('https://example.invalid/invite/synthetic-token')
  await page.getByRole('button', { name: 'Review invitation' }).click()
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/invite/synthetic-token',
  )
})

import { expect, test } from '@playwright/test'

test('shared typography scale reaches Dashboard, Group, Profile, and auth', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const surfaces = [
    '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    '/e2e/fixtures/group-chart-harness.html',
    '/e2e/fixtures/profile-harness.html',
    '/login',
  ]

  for (const surface of surfaces) {
    await page.goto(surface)
    const sizes = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.innerHTML =
        '<span class="text-xs">small</span><span class="text-sm">body</span><span class="text-base">base</span>'
      document.body.append(probe)
      const values = Array.from(probe.children, (element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      )
      probe.remove()
      return values
    })
    expect(sizes).toEqual([9, 9.45, 10.8])

    const zoomedBase = await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
      const probe = document.createElement('span')
      probe.className = 'text-base'
      document.body.append(probe)
      const size = Number.parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()
      document.documentElement.style.removeProperty('font-size')
      return size
    })
    expect(zoomedBase).toBe(21.6)
  }
})

test('Dashboard remains usable at 200% text sizing and reflows at a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.goto(
    '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
  )
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expect(page.getByRole('main')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(1280)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('font-size')
  })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390)
})

test('content type and controls shrink while navigation and chart geometry stay fixed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem(
      'slimpossible.local.personal-weigh-ins',
      JSON.stringify(
        [0, 2, 5].map((days, index) => ({
          id: `type-fixture-${index}`,
          userId: 'user-alex',
          date: new Date(Date.now() - days * 86400000)
            .toISOString()
            .slice(0, 10),
          weightKg: 90 - index,
          sharedChallengeIds: [],
          note: '',
        })),
      ),
    )
  })
  await page.goto(
    '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
  )

  const scale = await page.evaluate(() => {
    const header = document.querySelector('.app-shell-header')
    const main = document.querySelector('.app-shell-main')
    if (!header || !main) throw new Error('Expected the shared app shell')
    const headerProbe = document.createElement('span')
    const mainProbe = document.createElement('span')
    headerProbe.className = mainProbe.className = 'text-sm'
    header.append(headerProbe)
    main.append(mainProbe)
    const result = {
      header: Number.parseFloat(getComputedStyle(headerProbe).fontSize),
      main: Number.parseFloat(getComputedStyle(mainProbe).fontSize),
    }
    headerProbe.remove()
    mainProbe.remove()
    return result
  })
  expect(scale).toEqual({ header: 12.6, main: 9.45 })

  const mainControl = page.locator('.app-shell-main button').first()
  await expect(mainControl).toBeVisible()
  expect(
    await mainControl.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).minHeight),
    ),
  ).toBeGreaterThanOrEqual(44)

  const chart = page.getByRole('img', {
    name: /^Personal weight history chart/,
  })
  await expect(chart).toHaveAttribute('viewBox', '0 0 320 266')
  await expect(
    chart.locator('circle[data-point-kind="recorded"]').first(),
  ).toHaveAttribute('r', '5')
  await expect(chart.locator('[data-chart-trend]')).toHaveAttribute(
    'stroke-width',
    '2',
  )
  expect(
    await chart
      .locator('.chart-axis')
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBe(9)

  const inputSize = await page.evaluate(() => {
    const input = document.createElement('input')
    document.querySelector('.app-shell-main')?.append(input)
    const size = Number.parseFloat(getComputedStyle(input).fontSize)
    input.remove()
    return size
  })
  expect(inputSize).toBe(16)
})

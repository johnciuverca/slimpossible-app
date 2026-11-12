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
    '/register',
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

    if (surface === '/login' || surface === '/register') {
      const authSizes = await page.evaluate(() => {
        const heading = document.querySelector('.auth-page h1')
        const intro = document.querySelector('.auth-page p.text-lg')
        const label = document.querySelector('.auth-page label.text-sm')
        if (!heading || !intro || !label)
          throw new Error('Expected auth heading, intro, and form label')
        return [heading, intro, label].map((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        )
      })
      expect(authSizes).toEqual([18.9, 12.15, 9.45])
    }

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

  const contentControlMetrics = await page.evaluate(() => {
    const main = document.querySelector('.app-shell-main')
    if (!main) throw new Error('Expected the page content area')
    const button = document.createElement('button')
    button.className = 'rounded text-sm'
    button.textContent = 'Content action'
    main.append(button)
    const style = getComputedStyle(button)
    const metrics = {
      fontSize: Number.parseFloat(style.fontSize),
      minHeight: Number.parseFloat(style.minHeight),
      paddingBlock: Number.parseFloat(style.paddingBlockStart),
      paddingInline: Number.parseFloat(style.paddingInlineStart),
    }
    button.remove()
    return metrics
  })
  expect(contentControlMetrics).toEqual({
    fontSize: 9.45,
    minHeight: 44,
    paddingBlock: 6,
    paddingInline: 12,
  })

  const chart = page.getByRole('img', {
    name: /^Personal weight history chart/,
  })
  await expect(chart).toHaveAttribute('viewBox', '0 0 320 266')
  await expect(chart.locator('[data-chart-trend]').first()).toHaveAttribute(
    'stroke-width',
    '2',
  )
  await expect(chart.locator('[data-chart-trend]').first()).toHaveAttribute(
    'opacity',
    '0.32',
  )
  const chartText = await chart.evaluate((element) => ({
    axisTitle: Number.parseFloat(
      getComputedStyle(element.querySelector('.chart-axis-title')!).fontSize,
    ),
    axisTick: Number.parseFloat(
      getComputedStyle(element.querySelector('.chart-axis-tick')!).fontSize,
    ),
    value: Number.parseFloat(
      getComputedStyle(element.querySelector('.chart-value')!).fontSize,
    ),
    dateTick: Number.parseFloat(
      getComputedStyle(element.querySelector('[data-chart-date-tick]')!)
        .fontSize,
    ),
  }))
  expect(chartText).toEqual({
    axisTitle: 12,
    axisTick: 10.2,
    value: 9,
    dateTick: 10.2,
  })

  const inputSize = await page.evaluate(() => {
    const input = document.createElement('input')
    document.querySelector('.app-shell-main')?.append(input)
    const size = Number.parseFloat(getComputedStyle(input).fontSize)
    input.remove()
    return size
  })
  expect(inputSize).toBe(16)
})

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
    expect(sizes).toEqual([12, 12.6, 14.4])

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
    expect(zoomedBase).toBe(28.8)
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

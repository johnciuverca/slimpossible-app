import { expect, test } from '@playwright/test'

for (const width of [320, 390, 768, 1280, 1920]) {
  test(`workspace switcher, account menu and keyboard navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(
      '/e2e/fixtures/personal-dashboard-harness.html?scenario=tabs&path=%2Fdashboard%3Fchallenge%3Ddashboard-active',
    )
    const nav = page.getByRole('navigation', { name: 'Primary navigation' })
    const dashboard = nav.getByRole('link', { name: 'Dashboard', exact: true })
    const group = nav.getByRole('link', { name: 'Group', exact: true })
    const account = page.getByLabel('Profile and account for Synthetic Alex', {
      exact: true,
    })
    await expect(dashboard).toHaveAttribute('aria-current', 'page')
    await expect(dashboard).toHaveAttribute('href', '/dashboard')
    await expect(group).toHaveAttribute(
      'href',
      '/group?challenge=dashboard-active',
    )
    await group.click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/group?challenge=dashboard-active',
    )
    await expect(group).toHaveAttribute('aria-current', 'page')
    await expect(dashboard).not.toHaveAttribute('aria-current')
    await expect(group).toHaveCSS('background-color', 'rgb(37, 59, 45)')
    await expect(dashboard).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(account).toBeVisible()
    if (width > 640) {
      const visibleInkCenters = await page.evaluate(() => {
        const name = document.querySelector<HTMLElement>('.account-name')!
        const path = document.querySelector<SVGGraphicsElement>(
          '.account-chevron path',
        )!
        const nameStyle = getComputedStyle(name)
        const lineHeight = Number.parseFloat(nameStyle.lineHeight)
        const context = document.createElement('canvas').getContext('2d')!
        context.font = nameStyle.font
        const metrics = context.measureText(name.textContent ?? '')
        const baselineOffset =
          (lineHeight -
            metrics.fontBoundingBoxAscent -
            metrics.fontBoundingBoxDescent) /
            2 +
          metrics.fontBoundingBoxAscent
        const nameInkCenter =
          name.getBoundingClientRect().y +
          baselineOffset +
          (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) /
            2
        const bounds = path.getBBox()
        const pathCenter = new DOMPoint(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        ).matrixTransform(path.getScreenCTM()!)
        return { nameInkCenter, chevronInkCenter: pathCenter.y }
      })
      expect(
        Math.abs(
          visibleInkCenters.nameInkCenter - visibleInkCenters.chevronInkCenter,
        ),
        JSON.stringify(visibleInkCenters),
      ).toBeLessThanOrEqual(2)
    }
    const header = await page.getByRole('banner').boundingBox()
    const main = await page.getByRole('main').boundingBox()
    expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y + 1)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width)

    await page.getByRole('link', { name: 'Slimpossible', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(dashboard).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(group).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(account).toBeFocused()
    await expect(account).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('button', { name: 'Log out', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath(`workspace-navbar-${width}.png`),
    })
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Profile', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'Profile', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Close Profile' }).click()
    await expect(account).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Log out', exact: true }),
    ).toBeHidden()
    await account.click()
    await expect(
      page.getByRole('button', { name: 'Log out', exact: true }),
    ).toBeVisible()
    await page.getByRole('main').click({ position: { x: 12, y: 12 } })
    await expect(
      page.getByRole('button', { name: 'Log out', exact: true }),
    ).toBeHidden()
    await dashboard.click()
    await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
    await expect(dashboard).toHaveAttribute('aria-current', 'page')
  })
}

for (const width of [1280, 390]) {
  test(`brand hover and keyboard-focus affordances work in Dashboard and Group shells at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })

    for (const path of ['/', '/dashboard', '/group']) {
      await page.goto(
        `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`,
      )
      const brand = page.getByRole('link', {
        name: 'Slimpossible',
        exact: true,
      })
      await expect(brand).toHaveAttribute('href', '/dashboard')
      const initialBackground = await brand.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      )
      await brand.hover()
      await expect
        .poll(() =>
          brand.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        )
        .not.toBe(initialBackground)

      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await expect(brand).toBeFocused()
      await expect(brand).toHaveCSS('outline-style', 'solid')
      await expect
        .poll(() =>
          brand.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        )
        .not.toBe(initialBackground)
    }
  })

  test(`signed-in root Dashboard alias matches /dashboard shell at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const fixtureUrl = (path: string) =>
      `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

    const shellGeometry = async (path: string) => {
      await page.goto(fixtureUrl(path))
      const shell = page.locator('.app-shell')
      await expect(shell).toHaveClass(/shared-layout/)
      await expect(shell).toHaveClass(/dashboard-shell/)
      const dashboardLink = page
        .getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Dashboard', exact: true })
      await expect(dashboardLink).toHaveAttribute('aria-current', 'page')
      await expect(page.locator('.account-control > summary')).toContainText(
        'Synthetic Alex',
      )
      const header = await page.getByRole('banner').boundingBox()
      const main = await page.getByRole('main').boundingBox()
      expect(header).not.toBeNull()
      expect(main).not.toBeNull()
      expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y + 1)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(width)
      return { header, main }
    }

    const root = await shellGeometry('/')
    await page.reload()
    await expect(page.locator('.app-shell')).toHaveClass(/shared-layout/)
    await expect(page.getByTestId('fixture-route')).toHaveText('/')
    const dashboard = await shellGeometry('/dashboard')
    expect(root.header!.width).toBe(dashboard.header!.width)
    expect(root.main!.x).toBe(dashboard.main!.x)

    await page.goto(fixtureUrl('/'))
    await page.getByRole('link', { name: 'Slimpossible', exact: true }).focus()
    await page.keyboard.press('Tab')
    const dashboardLink = page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Dashboard', exact: true })
    await expect(dashboardLink).toBeFocused()
    await expect(dashboardLink).toHaveCSS('outline-style', 'solid')
    await page.getByRole('link', { name: 'Slimpossible', exact: true }).click()
    const route = page.getByTestId('fixture-route')
    await expect(route).toHaveText('/dashboard')
    await expect(page.locator('.app-shell')).toHaveClass(/shared-layout/)
    await page.getByRole('button', { name: 'Fixture back' }).click()
    await expect(route).toHaveText('/')
    await page.getByRole('button', { name: 'Fixture forward' }).click()
    await expect(route).toHaveText('/dashboard')
  })

  for (const path of ['/login', '/register']) {
    test(`public shell, form focus and validation on ${path} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto(path)
      const nav = page.getByRole('navigation', { name: 'Primary navigation' })
      await expect(nav.getByRole('link')).toHaveCount(3)
      await expect(
        nav.getByRole('link', {
          name: path === '/login' ? 'Log in' : 'Register',
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page')
      for (const name of ['Dashboard', 'Group', 'Profile', 'Log out'])
        await expect(page.getByRole('link', { name, exact: true })).toHaveCount(
          0,
        )
      await expect(
        page.getByRole('button', { name: 'Profile', exact: true }),
      ).toHaveCount(0)
      const shell = page.locator('.app-shell')
      await expect(shell).toHaveCSS('color-scheme', 'dark')
      const header = await page.getByRole('banner').boundingBox()
      const main = await page.getByRole('main').boundingBox()
      expect(header).not.toBeNull()
      expect(main).not.toBeNull()
      expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y + 1)
      await expect(shell).toHaveClass(/public-auth-shell/)
      const brandBox = await page
        .getByRole('link', { name: 'Slimpossible', exact: true })
        .boundingBox()
      const navBox = await nav.boundingBox()
      expect(brandBox).not.toBeNull()
      expect(navBox).not.toBeNull()
      expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(navBox!.x + 1)
      expect(
        await page
          .locator('.app-shell-header-inner')
          .evaluate((element) => getComputedStyle(element).flexDirection),
      ).toBe('row')
      await page
        .getByRole('link', { name: 'Slimpossible', exact: true })
        .focus()
      await page.keyboard.press('Tab')
      await expect(
        nav.getByRole('link', { name: 'Home', exact: true }),
      ).toBeFocused()
      const email = page.getByRole('textbox', { name: 'Email', exact: true })
      await email.focus()
      await expect(email).toBeFocused()
      await page
        .getByRole('button', {
          name: path === '/login' ? 'Sign in' : 'Create account',
          exact: true,
        })
        .click()
      await expect(email).toHaveAttribute('aria-invalid', 'true')
      await expect(
        page.getByText('Enter your email address.', { exact: true }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: test.info().outputPath(`public-${path.slice(1)}-${width}.png`),
        fullPage: true,
      })
    })
  }
  test(`authenticated top navbar persists from Dashboard to Group at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    const header = page.getByRole('banner')
    const before = await header.boundingBox()
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Group', exact: true })
      .click()
    await expect(
      page.getByText('Authorized selected Group destination', { exact: true }),
    ).toBeVisible()
    const after = await header.boundingBox()
    expect(after!.x).toBe(before!.x)
    expect(after!.width).toBe(before!.width)
    await expect(page.locator('.app-shell')).toHaveCSS('color-scheme', 'dark')
    const main = await page.getByRole('main').boundingBox()
    expect(after!.y + after!.height).toBeLessThanOrEqual(main!.y + 1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

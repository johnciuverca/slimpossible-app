import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
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
      if (width > 1100)
        expect(header!.x + header!.width).toBeLessThanOrEqual(main!.x + 1)
      else expect(header!.y + header!.height).toBeLessThanOrEqual(main!.y + 1)
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
  test(`authenticated sidebar persists from Dashboard to Group at ${width}px`, async ({
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
    if (width > 1100)
      expect(after!.x + after!.width).toBeLessThanOrEqual(main!.x + 1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}

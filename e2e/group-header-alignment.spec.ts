import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 568 },
]) {
  test(`Group tabs/header/action align without nested scrolling at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    for (const path of [
      '/goals?challenge=dashboard-active',
      '/challenges?challenge=dashboard-active',
      '/progress?challenge=dashboard-active',
      '/group',
    ]) {
      await page.goto(fixture(path))
      await expect(contexts).toHaveCount(1)
      await expect(
        contexts.getByRole('link', {
          name: /^Group · Synthetic draft group(?: \(selected\))?$/,
          exact: true,
        }),
      ).toBeVisible()
      const header = page.locator('[data-weight-page-header]')
      const action = page.getByRole('button', {
        name: 'Record weight',
        exact: true,
      })
      await expect(action).toBeEnabled()
      const navBox = (await contexts.boundingBox())!
      const headerBox = (await header.boundingBox())!
      const actionBox = (await action.boundingBox())!
      expect(headerBox.y - navBox.y - navBox.height).toBeCloseTo(24, 0)
      if (viewport.width > 600) {
        expect(actionBox.y - headerBox.y).toBeCloseTo(0, 0)
        expect(
          actionBox.x + actionBox.width - headerBox.x - headerBox.width,
        ).toBeCloseTo(0, 0)
      } else {
        const textBox = await header.evaluate((element) => {
          const box = element.firstElementChild!.getBoundingClientRect()
          return { bottom: box.bottom }
        })
        expect(actionBox.y - textBox.bottom).toBeCloseTo(16, 0)
      }
      if (path === '/group') {
        await expect(
          contexts.getByRole('link', { name: /Personal tracking/ }),
        ).toHaveCount(0)
        await expect(
          contexts.getByRole('link', { name: /Personal ·/ }),
        ).toHaveCount(0)
        expect(
          await contexts.evaluate((element) =>
            element.closest('.group-history-workspace'),
          ),
        ).toBeNull()
        const memberNavigation = page.locator(
          '.group-history-workspace > .sticky',
        )
        expect(
          await memberNavigation.evaluate((element) => {
            const style = getComputedStyle(element)
            return {
              maxHeight: style.maxHeight,
              overflowY: style.overflowY,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
            }
          }),
        ).toMatchObject({ maxHeight: 'none', overflowY: 'visible' })
        const memberBounds = await memberNavigation.evaluate((element) => ({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }))
        expect(memberBounds.scrollHeight).toBeLessThanOrEqual(
          memberBounds.clientHeight + 1,
        )
        await action.focus()
        await expect(action).toBeFocused()
        await expect
          .poll(() =>
            action.evaluate((element) => {
              const action = element.getBoundingClientRect()
              return action.top >= 0 && action.bottom <= window.innerHeight
            }),
          )
          .toBe(true)
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width)
    }
    const draft = contexts.getByRole('link', {
      name: /^Group · Synthetic draft group(?: \(selected\))?$/,
      exact: true,
    })
    await expect(draft).toHaveAttribute('aria-current', 'page')
    const active = contexts.getByRole('link', {
      name: /^Group · Synthetic active group(?: \(selected\))?$/,
      exact: true,
    })
    await active.focus()
    await expect(active).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/group?challenge=dashboard-active',
    )
    await expect(active).toHaveAttribute('aria-current', 'page')
    await expect(draft).not.toHaveAttribute('aria-current', 'page')
    await page.goto(fixture('/progress?challenge=dashboard-active'))
    await expect(
      contexts.getByRole('link', {
        name: 'Personal · Synthetic personal goal',
        exact: true,
      }),
    ).toBeVisible()
    await contexts
      .getByRole('link', {
        name: 'Personal · Synthetic personal goal',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/progress?challenge=dashboard-personal',
    )
    await page.goto(fixture('/group?challenge=missing'))
    await expect(
      contexts.getByText(
        'That group challenge is unavailable for this account.',
      ),
    ).toBeVisible()
    await expect(contexts.locator('[aria-current="page"]')).toHaveCount(0)
    await expect(contexts.getByRole('link', { name: /Personal/ })).toHaveCount(
      0,
    )
    await page.goto(fixture('/progress'))
    await page.getByRole('button', { name: 'Switch synthetic account' }).click()
    await expect(
      contexts.getByRole('link', { name: /Synthetic active group/ }),
    ).toHaveCount(0)
    await expect(
      contexts.getByRole('link', {
        name: 'Personal · Second account goal',
        exact: true,
      }),
    ).toBeVisible()
    await page.goto(fixture('/dashboard'))
    await expect(contexts).toHaveCount(0)
    await expect(
      page.getByRole('list', { name: 'Separate challenge summaries' }),
    ).toHaveCount(0)
  })
}

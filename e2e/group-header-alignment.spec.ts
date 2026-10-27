import { expect, test } from '@playwright/test'

const fixture = (path: string) =>
  `/e2e/fixtures/personal-dashboard-harness.html?${new URLSearchParams({ scenario: 'tabs', path })}`

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 568 },
  { width: 320, height: 568 },
  { width: 768, height: 900 },
]) {
  test(`Group tabs/header/action align without nested scrolling at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    await page.goto(fixture('/dashboard'))
    const dashboardAction = page.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    await expect(dashboardAction).toBeEnabled()
    for (const path of [
      '/goals?challenge=dashboard-active',
      '/challenges?challenge=dashboard-active',
      '/progress?challenge=dashboard-active',
      '/group',
    ]) {
      await page.goto(fixture(path))
      const personalWorkspace =
        path.startsWith('/goals') || path.startsWith('/progress')
      if (personalWorkspace) {
        await expect(contexts).toHaveCount(0)
        await expect(
          page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
        ).toBeVisible()
        await page
          .getByRole('navigation', { name: 'Dashboard sections' })
          .getByRole('link', { name: 'Overview', exact: true })
          .click()
        await expect(
          page.getByRole('button', { name: 'Record weight', exact: true }),
        ).toBeEnabled()
        await expect(
          page
            .locator('.dashboard-action-grid')
            .getByRole('button', { name: 'Record weight', exact: true }),
        ).toBeVisible()
        continue
      }
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
      if (path !== '/group' && !path.startsWith('/challenges')) {
        expect(headerBox.y - navBox.y - navBox.height).toBeCloseTo(24, 0)
      } else {
        expect(navBox.y - headerBox.y - headerBox.height).toBeCloseTo(24, 0)
      }
      if (viewport.width >= 1280) {
        const actionsBox = (await header
          .getByRole('group', { name: 'Group actions' })
          .boundingBox())!
        expect(actionBox.y - headerBox.y).toBeCloseTo(0, 0)
        expect(
          actionsBox.x + actionsBox.width - headerBox.x - headerBox.width,
        ).toBeCloseTo(0, 0)
      } else {
        const textBox = await header.evaluate((element) => {
          const box = element.firstElementChild!.getBoundingClientRect()
          return { bottom: box.bottom }
        })
        expect(actionBox.y - textBox.bottom).toBeCloseTo(16, 0)
      }
      if (path === '/group' || path.startsWith('/challenges')) {
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
        await page
          .getByRole('navigation', { name: 'Group sections' })
          .getByRole('link', { name: 'Charts', exact: true })
          .click()
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
      '/group?tab=charts&challenge=dashboard-active',
    )
    await expect(active).toHaveAttribute('aria-current', 'page')
    await expect(draft).not.toHaveAttribute('aria-current', 'page')
    await page.goto(fixture('/progress?challenge=dashboard-active'))
    const ownGoals = page.getByRole('navigation', {
      name: 'Your goal challenges',
    })
    await expect(
      ownGoals.getByRole('link', {
        name: 'Synthetic personal goal',
        exact: true,
      }),
    ).toBeVisible()
    await ownGoals
      .getByRole('link', {
        name: 'Synthetic personal goal',
        exact: true,
      })
      .click()
    await expect(page.getByTestId('fixture-route')).toHaveText(
      '/dashboard?tab=progress&challenge=dashboard-personal#goals',
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
      ownGoals.getByRole('link', { name: /Synthetic active group/ }),
    ).toHaveCount(0)
    await expect(
      ownGoals.getByRole('link', {
        name: 'Second account goal',
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

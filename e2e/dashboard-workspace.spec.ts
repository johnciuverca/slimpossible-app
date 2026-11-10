import { expect, test } from '@playwright/test'
const fixture = (path = '/dashboard', native = false) =>
  `/e2e/fixtures/dashboard-workspace-harness.html?${new URLSearchParams({ path, ...(native ? { native: '1' } : {}) })}`

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'narrow', width: 390 },
]) {
  test(`compact latest-weight summary and dashboard actions fit on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(fixture())
    await expect(page.getByText('Latest weight')).toBeVisible()
    const latestCard = page.locator('.dashboard-latest')
    const actionCard = page.locator('.dashboard-actions-compact')
    const actionGrid = actionCard.locator('.dashboard-action-grid')
    await expect(
      latestCard.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeVisible()
    await expect(
      actionGrid.getByRole('link', { name: 'Create challenge' }),
    ).toBeVisible()
    await expect(
      actionGrid.getByRole('button', { name: 'Invite people' }),
    ).toBeVisible()
    await expect(
      actionGrid.getByRole('button', { name: 'Join challenge' }),
    ).toBeVisible()
    await expect(
      actionGrid.getByRole('link', { name: 'My progress', exact: true }),
    ).toBeVisible()
    const [cardBox, gridBox] = await Promise.all([
      latestCard.boundingBox(),
      actionCard.boundingBox(),
    ])
    expect(cardBox).not.toBeNull()
    expect(gridBox).not.toBeNull()

    if (viewport.width >= 1100) {
      expect(Math.abs(cardBox!.y - gridBox!.y)).toBeLessThanOrEqual(1)
      expect(
        Math.abs(cardBox!.y + cardBox!.height - gridBox!.y - gridBox!.height),
      ).toBeLessThanOrEqual(1)
    } else {
      expect(gridBox!.y).toBeGreaterThanOrEqual(cardBox!.y + cardBox!.height)
      expect(Math.abs(cardBox!.height - gridBox!.height)).toBeGreaterThan(1)
    }
  })
}

for (const width of [320, 390, 430]) {
  for (const textSize of ['normal', 'increased']) {
    test(`mobile Dashboard spacing and contained actions at ${width}px with ${textSize} text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(fixture())
      if (textSize === 'increased') {
        await page.addStyleTag({
          content: `
            .dashboard-actions-compact .dashboard-action-grid-compact > a,
            .dashboard-actions-compact .dashboard-action-grid-compact > button {
              font-size: 20px !important;
              line-height: 1.2 !important;
            }
          `,
        })
      }
      const dashboardHeader = page.locator('.dashboard-workspace > header')
      const latestCard = page.locator('.dashboard-latest')
      const emptyConfirmation = page.locator(
        '.dashboard-save-confirmation-slot:empty',
      )
      const actionCard = page.locator('.dashboard-actions-compact')
      const actionGrid = actionCard.locator('.dashboard-action-grid')
      await expect(emptyConfirmation).toBeHidden()
      const [headerBox, latestBox] = await Promise.all([
        dashboardHeader.boundingBox(),
        latestCard.boundingBox(),
      ])
      expect(headerBox).not.toBeNull()
      expect(latestBox).not.toBeNull()
      expect(
        latestBox!.y - headerBox!.y - headerBox!.height,
      ).toBeLessThanOrEqual(24)

      const actionMetrics = await actionGrid
        .locator(':scope > a, :scope > button')
        .evaluateAll((actions) =>
          actions.map((action) => {
            const box = action.getBoundingClientRect()
            const style = getComputedStyle(action)
            const grid = action.parentElement!
            const gridStyle = getComputedStyle(grid)
            const card = grid.closest('.dashboard-actions-compact')!
            const cardBox = card.getBoundingClientRect()
            const cardStyle = getComputedStyle(card)
            const label = action.querySelector('span') ?? action
            const textWalker = document.createTreeWalker(
              label,
              NodeFilter.SHOW_TEXT,
            )
            const labelRects: Array<{
              left: number
              right: number
              top: number
              bottom: number
            }> = []
            while (textWalker.nextNode()) {
              const range = document.createRange()
              range.selectNodeContents(textWalker.currentNode)
              labelRects.push(
                ...Array.from(range.getClientRects()).map(
                  ({ left, right, top, bottom }) => ({
                    left,
                    right,
                    top,
                    bottom,
                  }),
                ),
              )
            }
            return {
              label: action.textContent?.trim(),
              x: box.x,
              y: box.y,
              right: box.right,
              bottom: box.bottom,
              height: box.height,
              paddingLeft: Number.parseFloat(style.paddingLeft),
              paddingRight: Number.parseFloat(style.paddingRight),
              paddingTop: Number.parseFloat(style.paddingTop),
              paddingBottom: Number.parseFloat(style.paddingBottom),
              borderLeft: Number.parseFloat(style.borderLeftWidth),
              borderRight: Number.parseFloat(style.borderRightWidth),
              borderTop: Number.parseFloat(style.borderTopWidth),
              borderBottom: Number.parseFloat(style.borderBottomWidth),
              cardContentLeft:
                cardBox.left +
                Number.parseFloat(cardStyle.borderLeftWidth) +
                Number.parseFloat(cardStyle.paddingLeft),
              cardContentRight:
                cardBox.right -
                Number.parseFloat(cardStyle.borderRightWidth) -
                Number.parseFloat(cardStyle.paddingRight),
              cardInnerBorderLeft:
                cardBox.left + Number.parseFloat(cardStyle.borderLeftWidth),
              cardInnerBorderRight:
                cardBox.right - Number.parseFloat(cardStyle.borderRightWidth),
              cardPaddingLeft: Number.parseFloat(cardStyle.paddingLeft),
              cardPaddingRight: Number.parseFloat(cardStyle.paddingRight),
              cardPaddingTop: Number.parseFloat(cardStyle.paddingTop),
              cardPaddingBottom: Number.parseFloat(cardStyle.paddingBottom),
              gridColumnGap: Number.parseFloat(gridStyle.columnGap),
              gridRowGap: Number.parseFloat(gridStyle.rowGap),
              fontSize: Number.parseFloat(style.fontSize),
              labelRects,
            }
          }),
        )
      expect(actionMetrics).toHaveLength(4)
      const longestLabel = actionMetrics.find(
        ({ label }) => label === 'Create challenge',
      )
      expect(longestLabel).toBeDefined()
      expect(actionMetrics.every(({ height }) => height >= 44)).toBe(true)
      expect(
        actionMetrics.every(
          ({ x, right, cardContentLeft, cardContentRight }) =>
            x >= cardContentLeft - 0.5 && right <= cardContentRight + 0.5,
        ),
      ).toBe(true)
      const borderInsets = actionMetrics.flatMap(
        ({ x, right, cardInnerBorderLeft, cardInnerBorderRight }) => [
          x - cardInnerBorderLeft,
          cardInnerBorderRight - right,
        ],
      )
      const actionRows = new Map<number, typeof actionMetrics>()
      for (const action of actionMetrics) {
        const row = Math.round(action.y)
        actionRows.set(row, [...(actionRows.get(row) ?? []), action])
      }
      const measuredGaps = [...actionRows.values()].flatMap((row) =>
        row
          .sort((left, right) => left.x - right.x)
          .slice(1)
          .map((action, index) => action.x - row[index].right),
      )
      const minimumButtonInset = Math.min(...borderInsets)
      const minimumButtonGap = Math.min(...measuredGaps)
      console.log('dashboard-action-containment', {
        width,
        textSize,
        minimumButtonInset,
        minimumButtonGap,
      })
      expect(minimumButtonInset).toBeGreaterThanOrEqual(8)
      expect(minimumButtonGap).toBeGreaterThanOrEqual(4)
      expect(
        actionMetrics.every(
          ({
            cardPaddingLeft,
            cardPaddingRight,
            cardPaddingTop,
            cardPaddingBottom,
          }) =>
            cardPaddingLeft >= 8 &&
            cardPaddingRight >= 8 &&
            cardPaddingTop >= 1 &&
            cardPaddingBottom >= 1,
        ),
      ).toBe(true)
      expect(
        actionMetrics.every(
          ({ gridColumnGap, gridRowGap }) =>
            gridColumnGap >= 4 && gridRowGap >= 4,
        ),
      ).toBe(true)
      expect(
        actionMetrics.every(
          ({ paddingLeft, paddingRight }) =>
            paddingLeft >= 10 && paddingRight >= 10,
        ),
      ).toBe(true)
      expect(
        actionMetrics.every(({ fontSize }) =>
          textSize === 'increased'
            ? fontSize === 20
            : fontSize >= 12 && fontSize <= 14,
        ),
      ).toBe(true)
      expect(
        actionMetrics.every(
          ({
            x,
            right,
            y,
            bottom,
            paddingLeft,
            paddingRight,
            paddingTop,
            paddingBottom,
            borderLeft,
            borderRight,
            borderTop,
            borderBottom,
            labelRects,
          }) =>
            labelRects.length > 0 &&
            labelRects.every(
              ({ left, right: labelRight, top, bottom: labelBottom }) =>
                left >= x + borderLeft + paddingLeft - 0.5 &&
                labelRight <= right - borderRight - paddingRight + 0.5 &&
                top >= y + borderTop + paddingTop - 0.5 &&
                labelBottom <= bottom - borderBottom - paddingBottom + 0.5,
            ),
        ),
        `Labels must remain inside padded button bounds: ${JSON.stringify(actionMetrics)}`,
      ).toBe(true)
      const rows = new Set(actionMetrics.map(({ y }) => Math.round(y)))
      if (width === 430 && textSize === 'normal') {
        expect(
          new Set(actionMetrics.map(({ height }) => Math.round(height))).size,
        ).toBe(1)
        expect(longestLabel!.labelRects.length).toBeGreaterThan(1)
      } else if (width < 360) {
        expect(rows.size).toBeGreaterThan(1)
      } else {
        expect(rows.size).toBe(1)
      }
      expect(rows.size).toBeLessThanOrEqual(4)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      if (width === 430 && textSize === 'normal') {
        await page.screenshot({
          path: test.info().outputPath('dashboard-actions-430.png'),
        })
      }
    })
  }
}

test('Dashboard Overview combines progress with latest weight at 390px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture())
  await expect(page.getByText('Latest weight')).toBeVisible()
  await expect(page.getByText('60 kg', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByRole('tablist', { name: 'Dashboard views' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Goals', exact: true }),
  ).toBeVisible()
  const myProgress = page.getByRole('link', { name: 'My progress' })
  await myProgress.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/dashboard?tab=overview#dashboard-progress-panel',
  )
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toBeVisible()
  await expect(page.getByText('Latest weight')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('link', { name: 'Weigh-ins', exact: true })
    .click()
  await expect(
    page
      .getByRole('list', { name: 'Personal weigh-in history' })
      .getByText('94.8 kg', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Synthetic private latest note')).toBeVisible()
  await expect(page.getByText('Peer secret must stay hidden')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByText('Latest weight')).toHaveCount(0)
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
  await page.goto(fixture('/dashboard?challenge=personal-goal#goals'))
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
  await expect(page.getByText(/95 kg ·/)).toHaveCount(0)
})

test('Legacy Progress direct-loads and refreshes; Back/Forward preserves history anchors', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress&challenge=personal-goal'))
  await page.reload()
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Your saved personal weigh-ins' }),
  ).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('link', { name: 'Weigh-ins', exact: true })
    .click()
  await expect(
    page.getByRole('list', { name: 'Personal weigh-in history' }),
  ).toBeVisible()
  await page.goto(fixture('/dashboard', true))
  await page.getByRole('link', { name: 'My progress' }).click()
  await page.evaluate(() => history.back())
  await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
  await page.evaluate(() => history.forward())
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toBeVisible()
})

test('Escape protects dirty input and restores focus when discarded', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress'))
  const action = page.getByRole('button', {
    name: 'Edit starting weight',
    exact: true,
  })
  await action.click()
  await page.getByLabel('Correct starting weight (kg)').fill('110')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('Correct starting weight (kg)')).toHaveValue(
    '110',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(action).toBeFocused()
})

test('browser Back keeps dirty target input until an explicit discard', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard', true))
  await page.getByRole('link', { name: 'My progress' }).click()
  await page
    .getByRole('button', { name: 'Edit starting weight', exact: true })
    .click()
  await page.getByLabel('Correct starting weight (kg)').fill('110')
  await page.evaluate(() => window.history.back())
  await expect(
    page.getByRole('dialog', { name: 'Discard unsaved input?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Stay', exact: true }).click()
  await expect(page.getByLabel('Correct starting weight (kg)')).toHaveValue(
    '110',
  )
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/dashboard?tab=overview#dashboard-progress-panel',
  )
  await expect(page).toHaveURL(
    /\/dashboard\?tab=overview#dashboard-progress-panel$/,
  )
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
  await page.getByRole('link', { name: 'My progress' }).click()
  await page
    .getByRole('button', { name: 'Edit starting weight', exact: true })
    .click()
  await page.getByLabel('Correct starting weight (kg)').fill('110')
  await page.evaluate(() => window.history.back())
  await page.getByRole('button', { name: 'Discard and leave' }).click()
  await expect(page.getByTestId('fixture-route')).toHaveText('/dashboard')
})

test('account and goal switching keep personal history separate and use the invitation route', async ({
  page,
}) => {
  await page.goto(fixture('/dashboard?tab=progress&challenge=goal-two'))
  await expect(
    page.getByText(/This personal goal is unavailable/),
  ).toBeVisible()
  await page
    .getByRole('link', { name: 'Synthetic personal goal', exact: true })
    .click()
  await expect(
    page.getByRole('img', { name: /^Personal weight history chart/ }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('link', { name: 'Weigh-ins', exact: true })
    .click()
  await expect(page.getByText('Synthetic private latest note')).toBeVisible()
  await page.getByRole('button', { name: 'Switch synthetic account' }).click()
  await expect(page.getByText('Synthetic second account note')).toBeVisible()
  await expect(page.getByText('Synthetic private latest note')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit starting weight', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('navigation', { name: 'Dashboard sections' })
    .getByRole('link', { name: 'Overview' })
    .click()
  await page.getByRole('button', { name: 'Join challenge' }).click()
  await page
    .getByLabel('Invitation link or token')
    .fill('https://example.invalid/invite/synthetic-token')
  await page.getByRole('button', { name: 'Review invitation' }).click()
  await expect(page.getByTestId('fixture-route')).toHaveText(
    '/invite/synthetic-token',
  )
})
for (const width of [1280, 390]) {
  for (const scenario of ['mixed', 'group-only', 'legacy-group']) {
    test(`Dashboard personal-goal boundary: ${scenario} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(
        fixture(
          scenario === 'legacy-group'
            ? '/dashboard?tab=overview&challenge=goal-one#goals'
            : '/dashboard',
        ) + (scenario === 'group-only' ? '&groupOnly=1' : ''),
      )
      await page
        .getByRole('navigation', { name: 'Dashboard sections' })
        .getByRole('link', { name: 'Overview', exact: true })
        .click()
      const goals = page.locator('#goals')
      await expect(
        goals.getByRole('link', { name: /Synthetic (first|second) group/ }),
      ).toHaveCount(0)
      await expect(
        goals.getByRole('button', { name: /Change target/ }),
      ).toHaveCount(0)
      await expect(goals.getByText(/95 kg ·/)).toHaveCount(0)
      const chart = page.getByRole('img', {
        name: /^Personal weight history chart/,
      })
      await expect(chart).toHaveCount(1)
      if (scenario === 'mixed') {
        await expect(
          goals.getByRole('link', {
            name: 'Synthetic personal goal',
            exact: true,
          }),
        ).toBeVisible()
        await expect(chart.locator('[data-chart-reference]')).toHaveCount(1)
        await expect(chart).toHaveAccessibleDescription(
          /Synthetic personal goal target is .* kilograms\. Its reference line is shown only when it fits within the data-scaled chart range/,
        )
        await expect(chart.locator('.chart-legend')).toHaveCount(0)
        await expect(
          goals.getByRole('button', { name: 'Edit starting weight' }),
        ).toBeVisible()
      } else {
        await expect(chart.locator('[data-chart-reference]')).toHaveCount(0)
        await expect(
          goals.getByRole('button', { name: 'Edit starting weight' }),
        ).toHaveCount(0)
        await expect(
          goals.getByText(
            scenario === 'group-only'
              ? /No personal goal yet/
              : /This personal goal is unavailable/,
          ),
        ).toBeVisible()
      }
      await page
        .getByRole('navigation', { name: 'Dashboard sections' })
        .getByRole('link', { name: 'Overview', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Record weight', exact: true })
        .click()
      const dialog = page.getByRole('dialog')
      await expect(
        dialog.getByRole('checkbox', {
          name: 'Synthetic first group',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('checkbox', {
          name: 'Synthetic second group',
          exact: true,
        }),
      ).toBeVisible()
      await dialog
        .getByRole('button', { name: 'Close weight editor', exact: true })
        .click()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    })
  }
}

import { expect, test } from '@playwright/test'

const viewports = [
  { label: 'narrow 320px', width: 320 },
  { label: 'mobile 390px', width: 390 },
  { label: 'mobile 430px', width: 430 },
  { label: 'desktop', width: 1280 },
]

for (const viewport of viewports) {
  test(`Dashboard personal trend fits the card and preserves point details at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.addInitScript(() => {
      const ago = (days: number) =>
        new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      const days = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365]
      localStorage.setItem(
        'slimpossible.local.personal-weigh-ins',
        JSON.stringify(
          days.map((daysAgo, index) => ({
            id: `trend-fit-${index}`,
            userId: 'user-alex',
            date: ago(daysAgo),
            weightKg: 105 - index * 0.5,
            sharedChallengeIds: [],
            note: '',
          })),
        ),
      )
    })
    await page.goto(
      '/e2e/fixtures/dashboard-workspace-harness.html?path=%2Fdashboard',
    )
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()

    const card = page
      .getByRole('heading', { name: 'Your personal trend' })
      .locator('xpath=..')
    const chartGroup = page.getByRole('group', {
      name: 'Personal weight chart',
    })
    const chart = chartGroup.getByRole('img', {
      name: /^Personal weight history chart/,
    })
    await expect(chart).toBeVisible()
    const axisTickSizes = await chart.evaluate((element) =>
      Array.from(element.querySelectorAll('.chart-axis-tick')).map(
        (tick) => getComputedStyle(tick).fontSize,
      ),
    )
    expect(axisTickSizes.length).toBeGreaterThan(0)
    expect(new Set(axisTickSizes)).toEqual(new Set(['10.2px']))
    await expect(chart.locator('.chart-axis-title')).toHaveCSS(
      'font-size',
      '12px',
    )
    await chart.scrollIntoViewIfNeeded()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)
    await expect(chart).toHaveAccessibleName(/13 saved weigh-ins/)
    await expect(
      chart.locator('circle[data-point-kind="weekly-summary"]'),
    ).toHaveCount(12)
    const valueLabels = chart.locator('.chart-value')
    await expect(valueLabels).toHaveCount(2)
    expect(
      await valueLabels.evaluateAll((labels) =>
        labels
          .map((label) => Number(label.getAttribute('data-value')))
          .sort((first, second) => first - second),
      ),
    ).toEqual([99, 105])
    if (viewport.width <= 600) {
      const labelBounds = await valueLabels.evaluateAll((labels) =>
        labels.map((label) => {
          const bounds = (label as SVGTextElement).getBBox()
          return { left: bounds.x, right: bounds.x + bounds.width }
        }),
      )
      const plotLeft = Number(await chart.getAttribute('data-chart-plot-left'))
      const plotRight = Number(
        await chart.getAttribute('data-chart-plot-right'),
      )
      for (const bounds of labelBounds) {
        expect(bounds.left).toBeGreaterThanOrEqual(plotLeft)
        expect(bounds.right).toBeLessThanOrEqual(plotRight)
      }
    }

    const [cardBox, groupBox, chartBox] = await Promise.all([
      card.boundingBox(),
      chartGroup.boundingBox(),
      chart.boundingBox(),
    ])
    expect(cardBox).not.toBeNull()
    expect(groupBox).not.toBeNull()
    expect(chartBox).not.toBeNull()
    expect(groupBox!.x).toBeGreaterThanOrEqual(cardBox!.x)
    expect(groupBox!.x + groupBox!.width).toBeLessThanOrEqual(
      cardBox!.x + cardBox!.width,
    )
    const frameBox = await chart.locator('xpath=../..').boundingBox()
    expect(frameBox).not.toBeNull()
    expect(frameBox!.x).toBeGreaterThanOrEqual(cardBox!.x)
    expect(
      cardBox!.x + cardBox!.width - frameBox!.x - frameBox!.width,
    ).toBeGreaterThanOrEqual(0)

    const compact = viewport.width <= 600
    await expect(chart).toHaveAttribute(
      'viewBox',
      compact ? '0 0 320 266' : '0 0 760 266',
    )
    await expect(chart).toHaveAttribute(
      'data-chart-plot-left',
      compact ? '32' : '44',
    )
    await expect(chart).toHaveAttribute(
      'data-chart-plot-right',
      compact ? '304' : '736',
    )
    await expect(chart).toHaveAttribute('data-chart-plot-top', '27')
    await expect(chart).toHaveAttribute('data-chart-plot-bottom', '230')
    if (!compact) {
      const dateLabelBounds = await chart
        .locator('[data-chart-date-tick]')
        .evaluateAll((labels) =>
          labels
            .map((label) => {
              const bounds = (label as SVGTextElement).getBBox()
              return { left: bounds.x, right: bounds.x + bounds.width }
            })
            .sort((first, second) => first.left - second.left),
        )
      expect(dateLabelBounds.length).toBeLessThanOrEqual(11)
      for (let index = 1; index < dateLabelBounds.length; index++)
        expect(dateLabelBounds[index - 1].right).toBeLessThanOrEqual(
          dateLabelBounds[index].left,
        )
      const desktopDateTicks = await chart
        .locator('[data-chart-date-tick]')
        .evaluateAll((labels) =>
          labels.map((label) => label.getAttribute('data-chart-date-tick')!),
        )
      const tickXs = await chart
        .locator('[data-chart-date-tick]')
        .evaluateAll((labels) =>
          labels.map((label) => Number(label.getAttribute('x'))),
        )
      for (let index = 1; index < desktopDateTicks.length; index++) {
        const distance =
          (Date.parse(`${desktopDateTicks[index]}T00:00:00Z`) -
            Date.parse(`${desktopDateTicks[index - 1]}T00:00:00Z`)) /
          86400000
        expect(distance).toBeGreaterThan(0)
        expect(tickXs[index] - tickXs[index - 1]).toBeCloseTo(
          tickXs[1] - tickXs[0],
          3,
        )
      }
    }
    const [rangeTicks, rangeControls, sliderTrack] = await Promise.all([
      chart
        .locator('[data-chart-date-tick]')
        .evaluateAll((ticks) =>
          ticks.map((tick) => tick.getAttribute('data-chart-date-tick')),
        ),
      page.getByRole('group', { name: 'Quick date ranges' }),
      page.getByRole('group', { name: 'Adjust visible date range' }),
    ])
    if (compact) {
      expect(rangeTicks.length).toBeLessThanOrEqual(4)
      const savedDates = await page.evaluate(() =>
        (
          JSON.parse(
            localStorage.getItem('slimpossible.local.personal-weigh-ins') ??
              '[]',
          ) as Array<{ date: string }>
        )
          .map(({ date }) => date)
          .sort(),
      )
      expect(rangeTicks[0]).toBe(savedDates[0])
      expect(rangeTicks.at(-1)! <= savedDates.at(-1)!).toBe(true)
      await expect(
        page.getByRole('status', { name: 'Visible date range' }),
      ).toContainText(savedDates.at(-1)!.split('-').reverse().join('.'))
      const plotMetrics = await chart.evaluate((element) => {
        const tickLabels = Array.from(
          element.querySelectorAll('[data-chart-tick] text'),
        )
        const plotLines = Array.from(
          element.querySelectorAll('[data-chart-tick] line'),
        )
        const labelLeft = Math.min(
          ...tickLabels.map((label) => label.getBBox().x),
        )
        const labelRight = Math.max(
          ...tickLabels.map((label) => {
            const bounds = label.getBBox()
            return bounds.x + bounds.width
          }),
        )
        const left = Math.min(
          ...plotLines.map((line) => Number(line.getAttribute('x1'))),
        )
        const right = Math.max(
          ...plotLines.map((line) => Number(line.getAttribute('x2'))),
        )
        return {
          labelLeft,
          labelRight,
          left,
          right,
          width: element.viewBox.baseVal.width,
        }
      })
      expect(plotMetrics.labelLeft).toBeGreaterThanOrEqual(0)
      expect(plotMetrics.labelRight).toBeLessThanOrEqual(plotMetrics.left)
      const sliderBox = await sliderTrack.boundingBox()
      expect(sliderBox).not.toBeNull()
      const expectedSliderLeft =
        chartBox!.x + (plotMetrics.left / plotMetrics.width) * chartBox!.width
      const expectedSliderRight =
        chartBox!.x + (plotMetrics.right / plotMetrics.width) * chartBox!.width
      expect(Math.abs(sliderBox!.x - expectedSliderLeft)).toBeLessThan(2)
      expect(
        Math.abs(sliderBox!.x + sliderBox!.width - expectedSliderRight),
      ).toBeLessThan(2)
      const dateRangeLabel = await rangeControls
        .getByText('Date range', { exact: true })
        .boundingBox()
      expect(dateRangeLabel).not.toBeNull()
      expect(dateRangeLabel!.y).toBeLessThan(
        (await rangeControls
          .getByRole('button', { name: 'Show last 1 week' })
          .boundingBox())!.y,
      )
      const presetBoxes = await rangeControls
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().y),
        )
      expect(Math.max(...presetBoxes) - Math.min(...presetBoxes)).toBeLessThan(
        1,
      )
      const controlBox = (await rangeControls.boundingBox())!
      expect(
        Math.abs(
          dateRangeLabel!.x +
            dateRangeLabel!.width / 2 -
            (controlBox.x + controlBox.width / 2),
        ),
      ).toBeLessThan(2)
    }

    for (const name of [
      'Show last 1 week',
      'Show last 2 weeks',
      'Show last 1 month',
      'Show last 3 months',
      'Show all dates',
    ]) {
      const control = rangeControls.getByRole('button', { name })
      await expect(control).toBeVisible()
      const controlBox = (await control.boundingBox())!
      expect(controlBox.x).toBeGreaterThanOrEqual(cardBox!.x)
      expect(controlBox.x + controlBox.width).toBeLessThanOrEqual(
        cardBox!.x + cardBox!.width,
      )
    }
    await expect(sliderTrack.getByRole('slider')).toHaveCount(2)
    for (const handle of await sliderTrack.getByRole('slider').all()) {
      const handleBox = (await handle.boundingBox())!
      if (viewport.width <= 600)
        expect(handleBox.height).toBeGreaterThanOrEqual(44)
      expect(handleBox.x).toBeGreaterThanOrEqual(cardBox!.x)
      expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(
        cardBox!.x + cardBox!.width,
      )
    }
    if (viewport.width <= 600) {
      for (const button of await rangeControls.getByRole('button').all()) {
        const box = (await button.boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }

    const point = chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
    const exactDetail = (await point.locator('title').textContent())!.replace(
      / recorded$/,
      '',
    )
    await point.dispatchEvent('pointerdown', { pointerType: 'touch' })
    const dailyTooltip = page.getByRole('tooltip')
    await expect(dailyTooltip).toHaveText(exactDetail)
    await expect(dailyTooltip).toHaveCSS('font-size', '10px')
    const dailyTooltipBox = (await dailyTooltip.boundingBox())!
    expect(dailyTooltipBox.height).toBeLessThanOrEqual(16)
    const pointDetails = page.getByRole('group', {
      name: /Chart point details/,
    })
    const pointDetailsBox = (await pointDetails.boundingBox())!
    expect(pointDetailsBox.x).toBeGreaterThanOrEqual(0)
    expect(pointDetailsBox.x + pointDetailsBox.width).toBeLessThanOrEqual(
      viewport.width,
    )
    const editPoint = pointDetails.getByRole('button', {
      name: 'Edit weight',
      exact: true,
    })
    await expect(editPoint).toHaveCSS('background-color', 'rgb(49, 219, 176)')
    await expect(editPoint).toHaveCSS('color', 'rgb(7, 43, 34)')
    expect((await editPoint.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({
      path: test.info().outputPath(`daily-tooltip-${viewport.width}.png`),
      fullPage: true,
    })
    await chart.dispatchEvent('keydown', { key: 'Escape' })
    await rangeControls
      .getByRole('button', { name: 'Show last 1 month' })
      .click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)
    await expect(
      chart.locator('circle[data-point-kind="weekly-summary"]'),
    ).toHaveCount(1)
    expect(
      await valueLabels.evaluateAll((labels) =>
        labels
          .map((label) => Number(label.getAttribute('data-value')))
          .sort((first, second) => first - second),
      ),
    ).toEqual([104.5, 105])
    await rangeControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`personal-trend-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

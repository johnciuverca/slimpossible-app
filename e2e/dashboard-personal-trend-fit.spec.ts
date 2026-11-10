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
    ).toHaveCount(13)
    const valueLabels = chart.locator('.chart-value')
    await expect(valueLabels).toHaveCount(2)
    expect(
      await valueLabels.evaluateAll((labels) =>
        labels
          .map((label) => Number(label.getAttribute('data-weight-kg')))
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
      for (const bounds of labelBounds) {
        expect(bounds.left).toBeGreaterThanOrEqual(48)
        expect(bounds.right).toBeLessThanOrEqual(312)
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
    expect(chartBox!.x).toBeGreaterThanOrEqual(groupBox!.x)
    expect(chartBox!.x + chartBox!.width).toBeLessThanOrEqual(
      groupBox!.x + groupBox!.width,
    )

    const compact = viewport.width <= 600
    await expect(chart).toHaveAttribute(
      'viewBox',
      compact ? '0 0 320 266' : '0 0 760 266',
    )
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
      expect(dateLabelBounds.length).toBeLessThanOrEqual(8)
      for (let index = 1; index < dateLabelBounds.length; index++)
        expect(dateLabelBounds[index - 1].right).toBeLessThanOrEqual(
          dateLabelBounds[index].left,
        )
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
      expect(rangeTicks.at(-1)).toBe(savedDates.at(-1))
      const scrollMetrics = await chartGroup.evaluate((element) => {
        const frame = element.querySelector('svg')?.parentElement?.parentElement
        return {
          groupClientWidth: element.clientWidth,
          groupScrollWidth: element.scrollWidth,
          frameClientWidth: frame?.clientWidth ?? 0,
          frameScrollWidth: frame?.scrollWidth ?? 0,
        }
      })
      expect(scrollMetrics.groupScrollWidth).toBeLessThanOrEqual(
        scrollMetrics.groupClientWidth + 1,
      )
      expect(scrollMetrics.frameScrollWidth).toBeLessThanOrEqual(
        scrollMetrics.frameClientWidth + 1,
      )
      const plotMetrics = await chart.evaluate((element) => {
        const tickLabels = Array.from(
          element.querySelectorAll('[data-chart-tick] text'),
        )
        const plotLines = Array.from(
          element.querySelectorAll('[data-chart-tick] line'),
        )
        const left = Math.min(...tickLabels.map((label) => label.getBBox().x))
        const right = Math.max(
          ...plotLines.map((line) => Number(line.getAttribute('x2'))),
        )
        return { left, right, width: element.viewBox.baseVal.width }
      })
      expect(
        Math.abs(plotMetrics.left - (plotMetrics.width - plotMetrics.right)),
      ).toBeLessThanOrEqual(3)
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
      expect(handleBox.x).toBeGreaterThanOrEqual(groupBox!.x)
      expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(
        groupBox!.x + groupBox!.width,
      )
    }

    const point = chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
    const exactDetail = (await point.locator('title').textContent())!.replace(
      / recorded$/,
      '',
    )
    await point.dispatchEvent('pointerdown', { pointerType: 'touch' })
    await expect(page.getByRole('tooltip')).toHaveText(exactDetail)
    await chart.dispatchEvent('keydown', { key: 'Escape' })
    await rangeControls
      .getByRole('button', { name: 'Show last 1 month' })
      .click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(2)
    expect(
      await valueLabels.evaluateAll((labels) =>
        labels
          .map((label) => Number(label.getAttribute('data-weight-kg')))
          .sort((first, second) => first - second),
      ),
    ).toEqual([104.5, 105])
    await rangeControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(13)

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

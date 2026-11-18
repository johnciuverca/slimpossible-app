import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'

const ownGroupId = '11111111-1111-4111-8111-111111111111'
const secondGroupId = '22222222-2222-4222-8222-222222222222'
const viewerId = '33333333-3333-4333-8333-333333333333'
const otherViewerId = '44444444-4444-4444-8444-444444444444'
const memberKey = (group: string, viewer: string) =>
  createHash('md5').update(`${group}:${viewer}`).digest('hex')
const supabaseRestUrl = 'https://group-preview.supabase.co/rest/v1'
type TargetChangeControl = { hold?: boolean; release?: () => void }
type StartingWeightCorrectionControl = { hold?: boolean; release?: () => void }

function shiftDate(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function installGroupFixtures(
  page: Page,
  multiple = false,
  ownEntries = false,
  differentWeights = false,
  initialOwnWeight?: number,
  priorOwnWeight?: number,
  targetChangeControl?: TargetChangeControl,
  startingWeightCorrectionControl?: StartingWeightCorrectionControl,
  challengeOwnerId = 'e2e-owner',
  options: {
    privateEntryAtEstimatedDate?: boolean
    privateEntrySharedWithOtherGroup?: boolean
    duplicateEstimateOnSave?: boolean
    holdPersonalContexts?: boolean
    participantAvatars?: boolean
    finalizedWeeklyResultForPrimaryGroup?: boolean
  } = {},
) {
  const challengeId = ownEntries ? ownGroupId : 'e2e-challenge'
  const secondId = ownEntries ? secondGroupId : 'e2e-second-group'
  const requests: string[] = []
  let ownWeight: number | null =
    initialOwnWeight ?? (differentWeights ? 95.1 : 88.5)
  let ownEstimatedSaved = false
  let ownEstimatedSavedWeight: number | null = null
  let ownEstimatedSharedChallengeIds: string[] = []
  let privateEntryAtEstimatedDate = options.privateEntryAtEstimatedDate ?? false
  let privateEntryWeight = 84.25
  const privateEntryNote = 'Private date collision must stay private'
  let privateEntrySharedChallengeIds: string[] =
    options.privateEntrySharedWithOtherGroup ? [secondId] : []
  const releasePersonalContexts: (() => void)[] = []
  let personalContextsHeld = false
  let ownTarget = 80
  let ownStartingWeight = 100
  const estimatedOwnWeight = () => {
    const firstWeight = differentWeights ? 9 : 90
    const finalWeight = ownWeight ?? (differentWeights ? 95.1 : 88.5)
    return (
      Math.round(
        (firstWeight + (finalWeight - firstWeight) / 2 + Number.EPSILON) * 20,
      ) / 20
    )
  }
  const privateEntry = () => ({
    id: 'disposable-own-private-entry',
    recorded_date: '2026-09-21',
    weight_kg: privateEntryWeight,
    note: privateEntryNote,
    shared_challenge_ids: privateEntrySharedChallengeIds,
  })
  page.on('request', (request) => requests.push(request.url()))

  await page.route(`${supabaseRestUrl}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (ownEntries && url.pathname === '/rest/v1/participants') {
      if (
        options.holdPersonalContexts &&
        url.searchParams.get('user_id') === `eq.${viewerId}`
      ) {
        personalContextsHeld = true
        await new Promise<void>((resolve) => {
          releasePersonalContexts.push(resolve)
        })
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'own-membership',
            challenge_id: challengeId,
            user_id: viewerId,
            display_name: 'Own viewer',
            starting_weight_kg: ownStartingWeight,
            target_weight_kg: ownTarget,
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
            joined_at: '2026-09-01T00:00:00Z',
          },
          {
            id: 'own-second-membership',
            challenge_id: secondId,
            user_id: viewerId,
            display_name: 'Own viewer',
            starting_weight_kg: 100,
            target_weight_kg: ownTarget,
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
            joined_at: '2026-09-01T00:00:00Z',
          },
        ]),
   …22684 tokens truncated…
    await expectChartFrameInsideCard(individualChart)
    await expect(individualChart.locator('.chart-axis-tick').first()).toHaveCSS(
      'font-size',
      '10.2px',
    )
    await expect(individualChart).toHaveAttribute(
      'data-chart-plot-left',
      viewport.width <= 600 ? '32' : '44',
    )
    await expect(individualChart).toHaveAttribute(
      'data-chart-plot-right',
      viewport.width <= 600 ? '304' : '736',
    )
    await individualChart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
      .hover()
    await expect(page.getByRole('tooltip')).toContainText(
      /Ava \(member 2\).*20\.09\.2026.*70 kg/,
    )
    await expect(groupLegend.locator('li > span > span:last-child')).toHaveText(
      ['Ava (member 2)'],
    )
    await expectLegendCentered()
    await expect(
      individualChart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(2)
    await individualChart.screenshot({
      path: test.info().outputPath(`group-individual-${viewport.width}.png`),
    })
    const individualTrack = page.getByRole('group', {
      name: 'Adjust visible date range',
    })
    const individualStart = individualTrack.getByRole('slider', {
      name: 'Visible range start',
    })
    await individualStart.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      individualChart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)
    const individualControls = page.getByRole('group', {
      name: 'Chart date range controls',
    })
    await individualControls
      .getByRole('button', { name: 'Show all dates' })
      .click()
    await expect(
      individualChart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(2)
    const individualEnd = individualTrack.getByRole('slider', {
      name: 'Visible range end',
    })
    const originalIndividualEnd =
      await individualEnd.getAttribute('aria-valuetext')
    await individualEnd.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(individualEnd).not.toHaveAttribute(
      'aria-valuetext',
      originalIndividualEnd!,
    )
    await expect(
      individualChart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(1)
    await individualControls
      .getByRole('button', { name: 'Show all dates' })
      .click()
    await expect(
      individualChart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(2)
    await all.click()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    const weights = page.getByRole('region', {
      name: 'Scrollable shared group weights',
    })
    await weights.focus()
    await page.keyboard.press('ArrowRight')
    if (viewport.width === 390) {
      await expect
        .poll(() => weights.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0)
    }
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const navigation = page.locator('.group-history-workspace > .sticky')
    expect(
      await navigation.evaluate((element) =>
        element.nextElementSibling?.getAttribute('role'),
      ),
    ).toBe('tabpanel')
    await expect(navigation).toHaveCSS('position', 'sticky')
    const navBounds = await navigation.boundingBox()
    expect(navBounds!.height).toBeLessThan(450)
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    await expect(table.getByRole('columnheader').first()).toHaveCSS(
      'position',
      'sticky',
    )
    await expect(table.getByRole('rowheader').first()).toHaveCSS(
      'position',
      'sticky',
    )
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width)
    expect(
      requests.some((url) =>
        /\/(personal_weigh_ins|weigh_ins)(?:\?|$)/.test(url),
      ),
    ).toBe(false)
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    await contexts
      .getByRole('link', {
        name: 'Group · Second authorized group',
        exact: true,
      })
      .press('Enter')
    await expect(
      tabs.getByRole('tab', { name: 'All members' }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(table).toContainText('Jo (member 1)')
    await expect(tabs.getByRole('tab', { name: /Ava/ })).toHaveCount(0)
  })
  test(`chart refresh handles gains, corrections, unsharing, loading and errors on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(page)
    let phase: 'rows' | 'corrected' | 'empty' | 'denied' | 'loading' = 'loading'
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      `${supabaseRestUrl}/rpc/get_group_chart_history`,
      async (route) => {
        if (phase === 'loading') await pending
        if (phase === 'denied') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Group membership required.' }),
          })
          return
        }
        const rows =
          phase === 'empty'
            ? []
            : [
                {
                  member_key: 'one',
                  display_name: 'Maintenance member',
                  recorded_date: '2026-09-20',
                  weight_kg: 80,
                },
                {
                  member_key: 'one',
                  display_name: 'Maintenance member',
                  recorded_date: '2026-09-21',
                  weight_kg: phase === 'corrected' ? 80.25 : 80,
                },
                {
                  member_key: 'two',
                  display_name: 'Gain member',
                  recorded_date: '2026-09-22',
                  weight_kg: 70,
                },
                {
                  member_key: 'two',
                  display_name: 'Gain member',
                  recorded_date: '2026-09-23',
                  weight_kg: 71,
                },
                {
                  member_key: 'two',
                  display_name: 'Gain member',
                  recorded_date: '2099-09-23',
                  weight_kg: 12,
                },
              ]
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(rows),
        })
      },
    )
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    await expect(page.getByText('Loading shared group history…')).toBeVisible()
    phase = 'rows'
    release()
    const table = page.getByRole('table', {
      name: 'Shared group weight history',
    })
    await expect(table).toContainText('+1 kg')
    await expect(table).toContainText('0 kg')
    await expect(table).not.toContainText('2099')
    const scroll = page.getByRole('region', {
      name: 'Scrollable shared group weights',
    })
    await scroll.focus()
    await expect(scroll).toBeFocused()
    await page.keyboard.press('ArrowRight')
    phase = 'corrected'
    await page.getByRole('button', { name: 'Refresh shared progress' }).click()
    await expect(table).toContainText('80.25 kg')
    await expect(table).toContainText('+0.25 kg')
    phase = 'empty'
    await page.getByRole('button', { name: 'Refresh shared progress' }).click()
    await expect(
      page.getByText('No entries have been shared with this group.'),
    ).toBeVisible()
    await expect(table).toHaveCount(0)
    phase = 'denied'
    await page.getByRole('button', { name: 'Refresh shared progress' }).click()
    await expect(
      page.getByText(
        'Shared group history is unavailable. Refresh shared progress to retry.',
      ),
    ).toBeVisible()
    await expect(table).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width)
  })
  test(`pill switch and direct refresh keep distinct authorized group records on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(
      page,
      true,
      false,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { finalizedWeeklyResultForPrimaryGroup: true },
    )
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    await expect(
      page.getByRole('table', { name: 'Shared group weight history' }),
    ).toContainText('Ava')
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    await expect(contexts).toHaveCount(1)
    const row = (await contexts.boundingBox())!
    const chart = (await page
      .locator('.group-history-workspace')
      .boundingBox())!
    expect(row.x).toBeCloseTo(chart.x, 0)
    expect(row.y + row.height).toBeLessThanOrEqual(chart.y)
    await expect(
      page
        .getByRole('navigation', { name: 'Group sections' })
        .getByRole('button', { name: 'Refresh shared progress' }),
    ).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Weekly results' })
      .click()
    const primaryWinnerList = page.getByRole('list', {
      name: 'Weekly winners',
    })
    await expect(primaryWinnerList).toContainText('Ava')
    await expect(primaryWinnerList).toContainText('Ben')
    await expect(
      page.getByText('Final shared weekly winners — 2 of 3 members recorded'),
    ).toBeVisible()
    await expect(
      primaryWinnerList.getByRole('listitem').filter({ hasText: 'Ben' }),
    ).toContainText('Ben')
    await expect(primaryWinnerList).not.toContainText(
      'Includes estimated weight',
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const second = contexts.getByRole('link', {
      name: 'Group · Second authorized group',
      exact: true,
    })
    await second.focus()
    await page.keyboard.press('Enter')
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    await expect(
      page.getByRole('table', { name: 'Shared group weight history' }),
    ).toContainText('Jo')
    await expect(
      page.getByRole('table', { name: 'Shared group weight history' }),
    ).not.toContainText('Ava')
    await expect(page.getByText('42.5%', { exact: true })).toHaveCount(0)
    await expect(
      contexts.getByRole('link', { name: /Second authorized group/ }),
    ).toHaveAttribute('aria-current', 'page')
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Weekly results' })
      .click()
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).toContainText('Jo')
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).not.toContainText('Ava')
    await page.goto(
      '/e2e/fixtures/today-harness.html?scenario=group&selected=e2e-second-group',
    )
    await page.reload()
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
    await expect(contexts.getByRole('combobox')).toHaveCount(0)
    await expect(
      page.getByText('fixture private note must never render'),
    ).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(viewport.width)
  })
  test(`renders only authorized Group data accessibly on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    const requests = await installGroupFixtures(
      page,
      false,
      false,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      'e2e-owner',
      { participantAvatars: true },
    )
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')

    await expect(
      page.getByRole('heading', { name: 'E2E authorized group', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    const overviewLegend = page.getByRole('list', {
      name: 'Group chart legend',
    })
    await expect(
      overviewLegend.locator('[data-avatar-preset="female-03"]'),
    ).toBeVisible()
    await expect(
      overviewLegend.locator('[data-avatar-preset="male-02"]'),
    ).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Weekly results' })
      .click()
    await expect(page.getByText('Shared provisional leaders')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).toContainText('Ava')
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).toContainText('Ben')
    await expect(
      page
        .getByRole('list', { name: 'Weekly winners' })
        .locator('[data-avatar-preset="female-03"]'),
    ).toBeVisible()
    await expect(
      page
        .getByRole('list', { name: 'Weekly winners' })
        .locator('[data-avatar-preset="male-02"]'),
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await expect(
      page.locator('#group-progress [data-avatar-preset="female-03"]'),
    ).toBeVisible()
    await expect(
      page.locator('#group-progress [data-avatar-preset="male-02"]'),
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Records', exact: true })
      .click()
    const historyPanel = page
      .getByRole('heading', { name: 'Group record history' })
      .locator('..')
    await expect(historyPanel.getByRole('table')).toContainText('88.50 kg')
    await expect(historyPanel.getByRole('table')).toContainText('-1.5 kg')
    await expect(historyPanel.getByRole('table')).toContainText(
      'Ava (member 1)',
    )
    await expect(historyPanel.getByRole('table')).toContainText(
      'Ava (member 2)',
    )
    const contrast = await historyPanel.evaluate((panel) => {
      const label = panel.querySelector('p')
      const body = panel.querySelector('p')
      if (!label || !body) {
        throw new Error('Unavailable history label or body copy is missing')
      }

      const parseRgb = (value: string) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Canvas context is unavailable for color contrast')
        }
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
      }
      const luminance = ([red, green, blue]: number[]) => {
        const linearize = (channel: number) => {
          const normalized = channel / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        }
        return (
          0.2126 * linearize(red) +
          0.7152 * linearize(green) +
          0.0722 * linearize(blue)
        )
      }
      const ratio = (foreground: string, background: string) => {
        const values = [
          luminance(parseRgb(foreground)),
          luminance(parseRgb(background)),
        ]
        const [lighter, darker] = values.sort((first, second) => second - first)
        return (lighter + 0.05) / (darker + 0.05)
      }
      const background = getComputedStyle(panel).backgroundColor

      return {
        body: ratio(getComputedStyle(body).color, background),
        label: ratio(getComputedStyle(label).color, background),
        opacity: Number(getComputedStyle(panel).opacity),
      }
    })
    expect(contrast.opacity).toBe(1)
    expect(contrast.label).toBeGreaterThanOrEqual(4.5)
    expect(contrast.body).toBeGreaterThanOrEqual(4.5)
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const chartPanel = page
      .getByRole('heading', { name: 'Group charts' })
      .locator('..')
    const chart = chartPanel.getByRole('img')
    await expect(chart).toHaveCount(1)
    await expect(chartPanel.getByRole('table')).toHaveCount(0)
    const quickRanges = chartPanel.getByRole('group', {
      name: 'Quick date ranges',
    })
    await expect(quickRanges.getByRole('button')).toHaveCount(5)
    const oneWeek = quickRanges.getByRole('button', {
      name: 'Show last 1 week',
    })
    await oneWeek.click()
    await expect(oneWeek).toHaveAttribute('aria-pressed', 'true')
    await expect(
      chartPanel.getByRole('status', { name: 'Visible date range' }),
    ).toContainText('Last 7 days')
    for (const [index, name] of [
      'Show last 1 week',
      'Show last 2 weeks',
      'Show last 1 month',
      'Show last 3 months',
      'Show all dates',
    ].entries()) {
      await expect(
        quickRanges.getByRole('button').nth(index),
      ).toHaveAccessibleName(name)
    }
    const chartPointCount = await chart
      .locator('circle[data-chart-point]')
      .count()
    await expect(chartPanel.getByRole('button')).toHaveCount(
      7 + chartPointCount,
    )

    await expect(
      page.getByText('fixture private note must never render'),
    ).toHaveCount(0)
    await expect(
      page.getByText('fixture leader note must never render'),
    ).toHaveCount(0)
    await expect(page.getByText('private@example.invalid')).toHaveCount(0)
    await expect(page.getByText('91.5')).toHaveCount(0)
    expect(requests.some((url) => /\/weigh_ins(?:\?|$)/.test(url))).toBe(false)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
  })

  test(`shows challenge-scoped progress and only own target action on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    const requests = await installGroupFixtures(page, true, true, false, 90)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()

    await expect(
      page.getByRole('heading', { name: 'Member progress' }),
    ).toBeVisible()
    const memberCards = page
      .locator('article')
      .filter({ hasText: 'Same display name' })
    await expect(memberCards).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: 'Change target' }),
    ).toHaveCount(1)
    await expect(
      page.getByText('Start: 100 kg · Current target: 80 kg').first(),
    ).toBeVisible()
    await expect(page.getByText(/Reached 90 kg/)).toBeVisible()
    await expect(page.getByText('hidden projection sentinel')).toHaveCount(0)
    await expect(page.getByText('raw_current_weight')).toHaveCount(0)
    expect(
      requests.some((url) => url.includes('/rpc/get_group_member_progress')),
    ).toBe(true)
    expect(requests.some((url) => /\/weigh_ins(?:\?|$)/.test(url))).toBe(false)
    await page.getByRole('button', { name: 'Change target' }).click()
    const targetInput = page.getByLabel('New target (kg)')
    await expect(targetInput).toHaveValue('80')
    await targetInput.fill('85')
    await page.getByRole('button', { name: 'Save target' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(/Current target: 85 kg/).first()).toBeVisible()
    expect(
      requests.some((url) => url.includes('/rpc/change_my_group_target')),
    ).toBe(true)
    await expect(
      page.getByRole('navigation', { name: 'Group sections' }),
    ).toHaveCount(1)
    await expect(
      page.getByRole('heading', { name: 'Member progress' }),
    ).toHaveCount(1)
  })

  test(`corrects only own Group starting weight and refreshes on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    const correctionControl: StartingWeightCorrectionControl = { hold: true }
    const requests = await installGroupFixtures(
      page,
      true,
      true,
      false,
      90,
      undefined,
      undefined,
      correctionControl,
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()

    const editButton = page.getByRole('button', {
      name: 'Edit starting weight',
    })
    await expect(editButton).toHaveCount(1)
    await editButton.click()
    const dialog = page.getByRole('dialog', {
      name: 'Edit your starting weight',
    })
    const input = dialog.getByLabel('Correct starting weight (kg)')
    await expect(input).toHaveValue('100')
    await expect(input).toBeFocused()
    await input.fill('79.99')
    await dialog.getByRole('button', { name: 'Save starting weight' }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'at least your current target',
    )
    expect(
      requests.filter((url) =>
        url.includes('/rpc/correct_my_enrollment_starting_weight'),
      ),
    ).toHaveLength(0)
    await input.fill('110.001')
    await dialog.getByRole('button', { name: 'Save starting weight' }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'no more than two decimal places',
    )

    await page.keyboard.press('Escape')
    const discardDialog = page.getByRole('dialog', {
      name: 'Discard unsaved input?',
    })
    await expect(discardDialog).toBeVisible()
    await discardDialog.getByRole('button', { name: 'Stay' }).click()
    await expect(input).toHaveValue('110.001')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page
      .getByRole('dialog', { name: 'Discard unsaved input?' })
      .getByRole('button', { name: 'Discard and leave' })
      .click()
    await expect(editButton).toBeFocused()
    await expect(dialog).toHaveCount(0)

    await editButton.click()
    const reopened = page.getByRole('dialog', {
      name: 'Edit your starting weight',
    })
    await reopened.getByLabel('Correct starting weight (kg)').fill('110')
    const form = reopened.locator('form')
    await form.evaluate((element: HTMLFormElement) => element.requestSubmit())
    await form.evaluate((element: HTMLFormElement) => element.requestSubmit())
    await expect(
      reopened.getByRole('button', { name: 'Saving starting weight…' }),
    ).toBeVisible()
    expect(
      requests.filter((url) =>
        url.includes('/rpc/correct_my_enrollment_starting_weight'),
      ),
    ).toHaveLength(1)
    correctionControl.release?.()

    await expect(reopened).toHaveCount(0)
    await expect(
      page.getByText('Start: 110 kg · Current target: 80 kg'),
    ).toBeVisible()
    await expect(
      page.getByText('Start: 100 kg · Current target: 80 kg'),
    ).toBeVisible()
    await expect(page.getByText('66.7%', { exact: true })).toBeVisible()
    await expect(page.getByText(/Reached 90 kg/)).toBeVisible()
    await expect(editButton).toBeFocused()
    expect(
      requests.filter((url) =>
        url.includes('/rpc/correct_my_enrollment_starting_weight'),
      ),
    ).toHaveLength(1)
  })

  test(`retains reached status from historical shared evidence on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(page, false, true, false, 90, 80)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Change target' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Change target' }).click()
    await page.getByLabel('New target (kg)').fill('85')
    await page.getByRole('button', { name: 'Save target' }).click()
    await expect(page.getByRole('alert')).toContainText(
      'After reaching a target, choose a lower target.',
    )
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test(`hides previous challenge progress while the new projection is pending on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(page, true, true, false, 90)
    let releaseProjection!: () => void
    const projectionPending = new Promise<void>((resolve) => {
      releaseProjection = resolve
    })
    await page.route(
      `${supabaseRestUrl}/rpc/get_group_member_progress`,
      async (route) => {
        const body = route.request().postDataJSON() as {
          target_challenge_id: string
        }
        if (body.target_challenge_id !== secondGroupId) {
          await route.fallback()
          return
        }
        await projectionPending
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Group membership required.' }),
        })
      },
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()
    const oldMember = page.getByRole('heading', {
      name: 'Same display name',
    })
    await expect(oldMember).toHaveCount(2)

    await page
      .getByRole('navigation', { name: 'Challenge contexts' })
      .getByRole('link', { name: 'Group · Second authorized group' })
      .click()
    await expect(oldMember).toHaveCount(0)
    await expect(page.getByText('Loading member progress…')).toBeVisible()
    releaseProjection()
    await expect(oldMember).toHaveCount(0)
    await expect(
      page.getByText('Member progress is unavailable for this session.'),
    ).toBeVisible()
  })

  test(`invalidates target dialogs on clean, dirty and saving context changes on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    const saveControl: TargetChangeControl = { hold: true }
    const requests = await installGroupFixtures(
      page,
      true,
      true,
      false,
      90,
      undefined,
      saveControl,
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    const firstGroup = contexts.getByRole('link', {
      name: 'Group · E2E authorized group',
    })
    const secondGroup = contexts.getByRole('link', {
      name: 'Group · Second authorized group',
    })

    await page.getByRole('button', { name: 'Change target' }).click()
    await secondGroup.evaluate((link: HTMLAnchorElement) => link.click())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(secondGroup).toHaveAttribute('aria-current', 'page')
    await firstGroup.click()

    await page.getByRole('button', { name: 'Change target' }).click()
    await page.getByLabel('New target (kg)').fill('85')
    await secondGroup.evaluate((link: HTMLAnchorElement) => link.click())
    const discardDialog = page.getByRole('dialog', {
      name: 'Discard unsaved input?',
    })
    await expect(discardDialog).toBeVisible()
    await discardDialog
      .getByRole('button', { name: 'Discard and leave' })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(secondGroup).toHaveAttribute('aria-current', 'page')
    await firstGroup.click()

    await page.getByRole('button', { name: 'Change target' }).click()
    await page.getByLabel('New target (kg)').fill('85')
    await page.getByRole('button', { name: 'Save target' }).click()
    await expect(
      page.getByRole('button', { name: 'Saving target…' }),
    ).toBeVisible()
    await expect.poll(() => Boolean(saveControl.release)).toBe(true)
    await secondGroup.evaluate((link: HTMLAnchorElement) => link.click())
    const savingDialog = page.getByRole('dialog', { name: 'Save in progress' })
    await expect(savingDialog).toBeVisible()
    await expect(
      savingDialog.getByRole('button', { name: 'Discard and leave' }),
    ).toHaveCount(0)
    await savingDialog.getByRole('button', { name: 'Stay' }).click()
    saveControl.release?.()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(firstGroup).toHaveAttribute('aria-current', 'page')
    expect(
      requests.filter((url) => url.includes('/rpc/change_my_group_target')),
    ).toHaveLength(1)
  })

  test(`shows above-start weight as signed red progress without rendering its raw value on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(page, true, true, false, 105)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Members', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Group · E2E authorized group' })
      .click()

    const negativeCard = page.locator('article').filter({ hasText: '-25%' })
    await expect(negativeCard).toHaveCount(1)
    const bar = negativeCard.getByRole('progressbar', {
      name: 'Same display name goal progress',
    })
    await expect(bar).toHaveAttribute('aria-valuenow', '-25')
    await expect(bar).toHaveAttribute('aria-valuetext', '-25%')
    const fill = bar.locator('[data-progress-fill]')
    await expect(fill).toHaveClass(/bg-red-600/)
    expect(
      await fill.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          left: style.left,
          transform: style.transform,
          width: (element as HTMLElement).style.width,
        }
      }),
    ).toEqual({
      left: '0px',
      transform: 'none',
      width: '25%',
    })
    await expect(page.getByText('105 kg')).toHaveCount(0)
    await expect(page.getByText('hidden projection sentinel')).toHaveCount(0)
  })
}

test('the shared chart range handles respond to mobile touch dragging', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 900 },
  })
  try {
    const page = await context.newPage()
    await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const points = chart.locator(
      'circle[data-point-kind="recorded"][data-date]',
    )
    await expect(points).toHaveCount(4)
    await page.evaluate(() =>
      document.querySelector('[data-chart-point]')?.scrollIntoView({
        block: 'center',
      }),
    )
    const firstPoint = chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
    await expect(firstPoint).toBeAttached()
    const firstPointBounds = await firstPoint.boundingBox()
    expect(firstPointBounds).not.toBeNull()
    await page.touchscreen.tap(
      firstPointBounds!.x + firstPointBounds!.width / 2,
      firstPointBounds!.y + firstPointBounds!.height / 2,
    )
    await expect(page.getByRole('tooltip')).toContainText(
      /Ava \(member 1\).*20\.09\.2026.*90 kg/,
    )
    const pointDetails = page.getByRole('group', {
      name: /Chart point details/,
    })
    const chartBox = (await chart.boundingBox())!
    await page.touchscreen.tap(chartBox.x + chartBox.width / 2, chartBox.y + 4)
    await expect(pointDetails).toHaveCount(0)

    const reopenedPointBounds = (await firstPoint.boundingBox())!
    await page.touchscreen.tap(
      reopenedPointBounds.x + reopenedPointBounds.width / 2,
      reopenedPointBounds.y + reopenedPointBounds.height / 2,
    )
    await expect(pointDetails).toBeVisible()
    await page.touchscreen.tap(5, 5)
    await expect(pointDetails).toHaveCount(0)
    const controls = page.getByRole('group', {
      name: 'Chart date range controls',
    })
    const sliderTrack = page.getByRole('group', {
      name: 'Adjust visible date range',
    })
    await expect(sliderTrack.getByRole('slider')).toHaveCount(2)
    const start = sliderTrack.getByRole('slider', {
      name: 'Visible range start',
    })
    await sliderTrack.scrollIntoViewIfNeeded()
    const initialDate = await start.getAttribute('aria-valuetext')
    const bounds = await sliderTrack.boundingBox()
    expect(bounds).not.toBeNull()
    const touch = await context.newCDPSession(page)
    const y = bounds!.y + bounds!.height / 2
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: bounds!.x + 1, y, id: 1 }],
    })
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: bounds!.x + (bounds!.width - 2) * progress + 1, y, id: 1 },
        ],
      })
    }
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await expect(start).not.toHaveAttribute('aria-valuetext', initialDate!)
    await expect(points).toHaveCount(1)
    const outputBox = await page
      .getByRole('status', { name: 'Visible date range' })
      .boundingBox()
    const sliderBox = await sliderTrack.boundingBox()
    expect(outputBox).not.toBeNull()
    expect(sliderBox).not.toBeNull()
    expect(sliderBox!.y).toBeGreaterThan(outputBox!.y)
    const showAllDates = controls.getByRole('button', {
      name: 'Show all dates',
    })
    await expect(showAllDates).toBeEnabled()
    await showAllDates.click()
    await expect(showAllDates).toHaveAttribute('aria-pressed', 'true')
    await expect(points).toHaveCount(4)
    await touch.detach()
  } finally {
    await context.close()
  }
})

test('archive missing-RPC feedback stays visible and announced', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(`${supabaseRestUrl}/challenges*`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        Array.from({ length: 6 }, (_, index) => ({
          id: `feedback-group-${index}`,
          challenge_kind: 'group',
          owner_id: viewerId,
          created_by: viewerId,
          name: `Feedback group ${index}`,
          start_date: '2026-01-01',
          end_date: '2099-01-01',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        })),
      ),
    }),
  )
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    `${supabaseRestUrl}/rpc/archive_group_challenge`,
    async (route) => {
      await pending
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PGRST202',
          message:
            'Could not find the function public.archive_group_challenge in the schema cache',
        }),
      })
    },
  )
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=/challenge/manage`,
  )
  const archive = page
    .getByRole('button', { name: 'Archive', exact: true })
    .first()
  await archive.click()
  await expect(page.getByRole('button', { name: 'Archiving…' })).toBeDisabled()
  release()
  const feedback = page
    .getByRole('status')
    .filter({ hasText: 'This challenge could not be archived.' })
  await expect(feedback).toBeVisible()
  await expect(feedback).toHaveAttribute('aria-live', 'polite')
  await expect(feedback).toBeInViewport()
  await expect(feedback).toBeFocused()
  await expect(archive).toBeEnabled()
})

test('archived groups leave normal navigation and remain accessible as read-only history', async ({
  page,
}) => {
  await installGroupFixtures(page, true, true)
  let archived = false
  const rows = () =>
    [ownGroupId, secondGroupId].map((id, index) => ({
      id,
      challenge_kind: 'group',
      owner_id: viewerId,
      created_by: viewerId,
      name:
        index === 0 ? 'Archived navigation group' : 'Current navigation group',
      start_date: '2026-01-01',
      end_date: '2099-01-01',
      status: index === 0 && archived ? 'archived' : 'active',
      archived_from_status: index === 0 && archived ? 'active' : null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }))
  await page.route(`${supabaseRestUrl}/challenges*`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(rows()),
    }),
  )
  await page.route(
    `${supabaseRestUrl}/rpc/archive_group_challenge`,
    (route) => {
      archived = true
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([rows()[0]]),
      })
    },
  )
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=/challenge/manage`,
  )
  await page
    .getByRole('article', { name: 'Archived navigation group' })
    .getByRole('button', { name: 'Archive', exact: true })
    .click()
  await page.getByRole('tab', { name: /Archived/ }).click()
  await page.getByRole('link', { name: 'View history', exact: true }).click()
  await expect(
    page.getByText('Archived · Read-only group history'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Archived navigation group',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Record weight', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Group sections' })
    .getByRole('link', { name: 'Members', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Member progress' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Change target', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit starting weight', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Manage challenges', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Manage invitations', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Manage members', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('link', { name: 'View current groups', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Current navigation group',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Group · Archived navigation group/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /Group · Current navigation group/ }),
  ).toHaveAttribute('aria-current', 'page')
  // A direct old bookmark remains explicit read-only history after a reload.
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=${encodeURIComponent(`/group?challenge=${ownGroupId}`)}`,
  )
  await expect(
    page.getByText('Archived · Read-only group history'),
  ).toBeVisible()
  // A page with no explicit selection revalidates on return from another tab.
  archived = false
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=/group`,
  )
  await expect(
    page.getByRole('heading', {
      name: 'Archived navigation group',
      exact: true,
    }),
  ).toBeVisible()
  archived = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByRole('heading', {
      name: 'Current navigation group',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Group · Archived navigation group/ }),
  ).toHaveCount(0)
  archived = false
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=${encodeURIComponent(`/group?challenge=${ownGroupId}&tab=members`)}`,
  )
  await expect(
    page.getByRole('button', { name: 'Change target', exact: true }),
  ).toBeVisible()
  archived = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByText('Archived · Read-only group history'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Change target', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Edit starting weight', exact: true }),
  ).toHaveCount(0)
  await page.screenshot({
    path: test.info().outputPath('archive-history-preview.png'),
    fullPage: true,
  })
})

test.describe('group chart weigh-in dots', () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 900 } })

  test('adds the current Group share to an estimate-resolved entry while preserving its other share', async ({
    page,
  }) => {
    const requests = await installGroupFixtures(
      page,
      true,
      true,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      'e2e-owner',
      {
        privateEntryAtEstimatedDate: true,
        privateEntrySharedWithOtherGroup: true,
      },
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const ownEstimate = chart.locator(
      `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="estimated"]`,
    )
    await expect(ownEstimate).toHaveAttribute('data-value', '89.25')
    await expect(chart).not.toContainText('84.25')
    await expect(chart).not.toContainText(
      'Private date collision must stay private',
    )

    await ownEstimate.focus()
    await page.keyboard.press('Enter')
    const estimateTooltip = page.getByRole('tooltip')
    await expect(estimateTooltip).toContainText('Estimated')
    await expect(estimateTooltip).toHaveCSS('font-size', '8.5px')
    const recordEstimate = page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
    await expect(recordEstimate).toBeFocused()
    const recordLabel = recordEstimate.locator('span')
    await expect(recordLabel).toHaveCSS('font-size', '8px')
    await expect(recordLabel).toHaveCSS('background-color', 'rgb(49, 219, 176)')
    const [estimatePopoverBox, estimateTextBox, recordLabelBox] =
      await Promise.all([
        page.getByRole('group', { name: /Chart point details/ }).boundingBox(),
        estimateTooltip.boundingBox(),
        recordLabel.boundingBox(),
      ])
    expect(estimatePopoverBox).not.toBeNull()
    expect(estimateTextBox).not.toBeNull()
    expect(recordLabelBox).not.toBeNull()
    for (const box of [estimateTextBox!, recordLabelBox!])
      expect(
        Math.abs(
          box.x +
            box.width / 2 -
            (estimatePopoverBox!.x + estimatePopoverBox!.width / 2),
        ),
      ).toBeLessThanOrEqual(1)
    await page.screenshot({
      path: test.info().outputPath('group-estimate-tooltip-1280.png'),
      fullPage: true,
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    const edit = page.getByRole('dialog', { name: 'Edit weight' })
    await expect(edit.getByLabel('Date')).toHaveValue('2026-09-21')
    await expect(edit.getByLabel('Weight in kg')).toHaveValue('84.25')
    await expect(edit.getByLabel('Private note (optional)')).toHaveValue(
      'Private date collision must stay private',
    )
    await expect(edit.getByLabel('E2E authorized group')).toBeChecked()
    await expect(edit.getByLabel('Second authorized group')).toBeChecked()
    await expect(edit.getByText(/matches a saved personal entry/)).toBeVisible()

    await edit.getByLabel('Weight in kg').fill('84.5')
    await edit.getByRole('button', { name: 'Close' }).click()
    const discard = page.getByRole('dialog', { name: 'Discard unsaved input?' })
    await discard.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(edit).toHaveCount(0)
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(0)

    await ownEstimate.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    const reopened = page.getByRole('dialog', { name: 'Edit weight' })
    await expect(reopened.getByLabel('Weight in kg')).toHaveValue('84.25')
    await expect(reopened.getByLabel('Private note (optional)')).toHaveValue(
      'Private date collision must stay private',
    )
    await expect(reopened.getByLabel('E2E authorized group')).toBeChecked()
    await expect(reopened.getByLabel('Second authorized group')).toBeChecked()
    await reopened.getByLabel('Weight in kg').fill('84.5')
    await reopened.getByRole('button', { name: 'Update weight' }).click()
    await expect(reopened).toHaveCount(0)
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(1)
    const collisionRecorded = chart.locator(
      `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="recorded"]`,
    )
    await expect(collisionRecorded).toBeVisible()
    await expect(collisionRecorded).toHaveAttribute('data-value', '84.5')
    await expect(collisionRecorded.locator('title')).toContainText('84.5 kg')
    await expect(chart).not.toContainText(
      'Private date collision must stay private',
    )
  })

  test('waits for eligible sharing contexts before mounting an estimate-resolved editor', async ({
    page,
  }) => {
    const fixture = await installGroupFixtures(
      page,
      true,
      true,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      'e2e-owner',
      {
        privateEntryAtEstimatedDate: true,
        privateEntrySharedWithOtherGroup: true,
        holdPersonalContexts: true,
      },
    )
    const personalHistoryResponse = page.waitForResponse((response) =>
      response.url().includes('/rpc/list_my_personal_weigh_ins'),
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    await expect.poll(fixture.personalContextsHeld).toBe(true)
    await personalHistoryResponse
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const estimate = chart.locator(
      `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="estimated"]`,
    )
    await expect(estimate).toBeVisible()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
    await estimate.focus()
    await expect(estimate).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    fixture.releasePersonalContexts()
    const edit = page.getByRole('dialog', { name: 'Edit weight' })
    await expect(edit.getByLabel('Date')).toHaveValue('2026-09-21')
    await expect(edit.getByLabel('Weight in kg')).toHaveValue('84.25')
    await expect(edit.getByLabel('E2E authorized group')).toBeChecked()
    await expect(edit.getByLabel('Second authorized group')).toBeChecked()
    await edit.getByRole('button', { name: 'Close' }).click()
    await expect(edit).toHaveCount(0)
    expect(
      fixture.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(0)
  })

  test('recovers into the saved editor when an estimate create hits a date conflict', async ({
    page,
  }) => {
    const requests = await installGroupFixtures(
      page,
      true,
      true,
      false,
      88.51,
      undefined,
      undefined,
      undefined,
      'e2e-owner',
      { duplicateEstimateOnSave: true },
    )
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    await page.getByRole('tab', { name: 'Ava (member 1)' }).click()
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const ownEstimate = chart.locator(
      `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="estimated"]`,
    )
    await expect(ownEstimate).toBeVisible()
    await expect(ownEstimate).toHaveAttribute('data-value', '89.25')
    await expect(ownEstimate.locator('title')).toContainText('89.25 kg')
    await ownEstimate.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    const create = page.getByRole('dialog', { name: 'Record weight' })
    await expect(create.getByLabel('Weight in kg')).toHaveValue('89.25')
    await expect(create.getByLabel('E2E authorized group')).toBeChecked()
    await create.getByRole('button', { name: 'Save weight' }).click()

    const recoveredEdit = page.getByRole('dialog', { name: 'Edit weight' })
    await expect(recoveredEdit.getByLabel('Date')).toHaveValue('2026-09-21')
    await expect(recoveredEdit.getByLabel('Weight in kg')).toHaveValue('84.25')
    await expect(
      recoveredEdit.getByLabel('Private note (optional)'),
    ).toHaveValue('Private date collision must stay private')
    await expect(recoveredEdit.getByLabel('E2E authorized group')).toBeChecked()
    await expect(
      recoveredEdit.getByText(/matches a saved personal entry/),
    ).toBeVisible()
    await recoveredEdit.getByLabel('Weight in kg').fill('84.5')
    await recoveredEdit.getByRole('button', { name: 'Update weight' }).click()
    await expect(recoveredEdit).toHaveCount(0)
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(2)
    await expect(
      chart.locator(
        `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="recorded"]`,
      ),
    ).toBeVisible()
    const recoveredRecorded = chart.locator(
      `circle[data-series-id="${memberKey(ownGroupId, viewerId)}"][data-date="2026-09-21"][data-point-kind="recorded"]`,
    )
    await expect(recoveredRecorded).toHaveAttribute('data-value', '84.5')
    await expect(recoveredRecorded.locator('title')).toContainText('84.5 kg')
    await expect(chart).not.toContainText(
      'Private date collision must stay private',
    )
  })

  test('own points edit/create through explicit save; another member remains read-only', async ({
    page,
  }) => {
    const requests = await installGroupFixtures(page, true, true)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    const ownKey = memberKey(ownGroupId, viewerId)
    const otherKey = memberKey(ownGroupId, otherViewerId)
    const ownRecorded = chart.locator(
      `circle[data-series-id="${ownKey}"][data-date="2026-09-22"][data-point-kind="recorded"]`,
    )
    const ownEstimate = chart.locator(
      `circle[data-series-id="${ownKey}"][data-date="2026-09-21"][data-point-kind="estimated"]`,
    )
    const otherRecorded = chart.locator(
      `circle[data-series-id="${otherKey}"][data-date="2026-09-21"][data-point-kind="recorded"]`,
    )

    await expect(ownRecorded).toBeVisible()
    await expect(ownEstimate).toHaveAttribute('aria-label', /Estimated/)
    await otherRecorded.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const otherDetails = page.getByRole('group', {
      name: /Chart point details/,
    })
    await expect(otherDetails).toBeVisible()
    await expect(otherDetails.getByRole('button')).toHaveCount(0)

    await ownRecorded.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    const edit = page.getByRole('dialog', { name: 'Edit weight' })
    await expect(edit.getByLabel('Date')).toHaveValue('2026-09-22')
    await expect(edit.getByLabel('Weight in kg')).toHaveValue('88.5')
    await expect(edit.getByLabel('Private note (optional)')).toHaveValue(
      'Author-only disposable private note',
    )
    await expect(edit.getByLabel('E2E authorized group')).toBeChecked()
    await expect(edit.getByLabel('Second authorized group')).toBeChecked()
    await edit.getByLabel('Weight in kg').fill('88.75')
    await edit.getByRole('button', { name: 'Update weight' }).click()
    await expect(edit).toHaveCount(0)
    await expect(ownRecorded).toHaveAttribute('data-value', '88.75')
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(1)

    const tapEstimate = async () => {
      const bounds = await ownEstimate.boundingBox()
      expect(bounds).not.toBeNull()
      await page.touchscreen.tap(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
      )
    }
    await tapEstimate()
    const recordWeight = page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
    await expect(recordWeight).toBeVisible()
    const recordWeightBounds = await recordWeight.boundingBox()
    expect(recordWeightBounds!.height).toBeGreaterThanOrEqual(44)
    await page.touchscreen.tap(
      recordWeightBounds!.x + recordWeightBounds!.width / 2,
      recordWeightBounds!.y + recordWeightBounds!.height / 2,
    )
    const create = page.getByRole('dialog', { name: 'Record weight' })
    await expect(create.getByLabel('Date')).toHaveValue('2026-09-21')
    await expect(create.getByLabel('Weight in kg')).toHaveValue('89.4')
    await expect(create.getByText(/display-only estimate/)).toBeVisible()
    const groupShare = create.getByLabel('E2E authorized group')
    await expect(groupShare).toBeChecked()
    const saveRequestsBeforeCancel = requests.filter((url) =>
      url.includes('/rpc/save_personal_weigh_in'),
    ).length
    await groupShare.uncheck()
    await create.getByRole('button', { name: 'Close' }).click()
    const discard = page.getByRole('dialog', { name: 'Discard unsaved input?' })
    await discard.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(create).toHaveCount(0)
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(saveRequestsBeforeCancel)

    await tapEstimate()
    await page
      .getByRole('group', { name: /Chart point details/ })
      .getByRole('button', { name: 'Record weight', exact: true })
      .click()
    const confirmedCreate = page.getByRole('dialog', { name: 'Record weight' })
    await expect(
      confirmedCreate.getByLabel('E2E authorized group'),
    ).toBeChecked()
    await confirmedCreate.getByRole('button', { name: 'Save weight' }).click()
    await expect(confirmedCreate).toHaveCount(0)
    await expect(
      chart.locator(
        `circle[data-series-id="${ownKey}"][data-date="2026-09-21"][data-point-kind="recorded"]`,
      ),
    ).toBeVisible()
    await expect(
      chart.locator(
        `circle[data-series-id="${ownKey}"][data-date="2026-09-21"][data-point-kind="estimated"]`,
      ),
    ).toHaveCount(0)
    expect(
      requests.filter((url) => url.includes('/rpc/save_personal_weigh_in')),
    ).toHaveLength(saveRequestsBeforeCancel + 1)
    await expect(
      page.getByText('Author-only disposable private note'),
    ).toHaveCount(0)
  })
})

for (const width of [1440, 1280, 1024, 768, 390, 360]) {
  test(`approved Group shell shares chart boundaries at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await installGroupFixtures(page, false, true)
    let owner = true
    await page.route(`${supabaseRestUrl}/challenges*`, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: ownGroupId,
            challenge_kind: 'group',
            owner_id: owner ? viewerId : otherViewerId,
            created_by: viewerId,
            name: 'testtest',
            status: 'active',
            start_date: '2026-01-01',
            end_date: '2099-01-01',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]),
      }),
    )
    const url = `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=${encodeURIComponent(`/group?challenge=${ownGroupId}`)}`
    await page.goto(url)
    await expect(
      page.locator('.group-history-workspace svg').first(),
    ).toBeVisible()
    const overviewChart = page
      .locator('.group-history-workspace svg[role="img"]')
      .first()
    await expect(overviewChart).toHaveAttribute(
      'data-chart-plot-left',
      width <= 600 ? '32' : '44',
    )
    await expect(overviewChart).toHaveAttribute(
      'data-chart-plot-right',
      width <= 600 ? '304' : '736',
    )
    const [overviewCardBounds, overviewFrameBounds] = await Promise.all([
      overviewChart.locator('xpath=ancestor::section[1]').boundingBox(),
      overviewChart.locator('xpath=../..').boundingBox(),
    ])
    expect(overviewCardBounds).not.toBeNull()
    expect(overviewFrameBounds).not.toBeNull()
    expect(overviewFrameBounds!.x).toBeGreaterThanOrEqual(overviewCardBounds!.x)
    expect(
      overviewFrameBounds!.x + overviewFrameBounds!.width,
    ).toBeLessThanOrEqual(overviewCardBounds!.x + overviewCardBounds!.width)
    await expect(overviewChart).toHaveAttribute('data-chart-plot-top', '27')
    const overviewViewBoxHeight = await overviewChart.evaluate((chart) =>
      Number(chart.getAttribute('viewBox')?.trim().split(/\s+/)[3]),
    )
    await expect(overviewChart).toHaveAttribute(
      'data-chart-plot-bottom',
      String(overviewViewBoxHeight - 36),
    )
    const nav = page.getByRole('navigation', { name: 'Group sections' })
    for (const name of [
      'Record weight',
      'Create or join a group',
      'Refresh shared progress',
    ])
      await expect(nav.getByRole('button', { name, exact: true })).toHaveCount(
        1,
      )
    const edges = await page.evaluate(() => {
      const chart = document
        .querySelector('.group-history-workspace')!
        .getBoundingClientRect()
      const selector = document
        .querySelector('[aria-label="Challenge contexts"] > div')!
        .getBoundingClientRect()
      const tabs = document
        .querySelector('.group-context-subnav .contextual-subnav-scroll')!
        .getBoundingClientRect()
      const refresh = document
        .querySelector('.group-refresh-action')!
        .getBoundingClientRect()
      const arrow = document
        .querySelector('.account-chevron svg')!
        .getBoundingClientRect()
      const cards = Array.from(
        document.querySelectorAll('.group-overview-metric'),
      ).map((card) => ({
        bounds: card.getBoundingClientRect().toJSON(),
        border: ['Top', 'Right', 'Bottom', 'Left'].map((side) => ({
          width: getComputedStyle(card).getPropertyValue(
            `border-${side.toLowerCase()}-width`,
          ),
          color: getComputedStyle(card).getPropertyValue(
            `border-${side.toLowerCase()}-color`,
          ),
        })),
      }))
      const plot = document
        .querySelector('.group-history-workspace svg')!
        .getBoundingClientRect()
      return {
        chart: { left: chart.left, right: chart.right },
        selector: selector.left,
        tabs: tabs.left,
        refresh: refresh.right,
        arrow: arrow.right,
        cards,
        plot: { width: plot.width, height: plot.height },
        overflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    for (const edge of [
      edges.selector,
      edges.tabs,
      Math.min(...edges.cards.map((c) => c.bounds.x)),
    ])
      expect(Math.abs(edge - edges.chart.left)).toBeLessThanOrEqual(1)
    for (const edge of [
      edges.refresh,
      edges.arrow,
      Math.max(...edges.cards.map((c) => c.bounds.right)),
    ])
      expect(Math.abs(edge - edges.chart.right)).toBeLessThanOrEqual(1)
    expect(edges.overflow).toBe(0)
    for (const card of edges.cards)
      for (const side of card.border) {
        expect(side.width).toBe('1px')
        expect(side.color).toBe('rgb(53, 67, 83)')
      }
    if (width === 1440) {
      expect(edges.plot.width).toBeCloseTo(1206, 0)
      expect(edges.plot.height).toBeCloseTo(441.140625, 0)
    }
    if (width === 390) {
      expect(edges.plot.width).toBeLessThan(600)
      expect(edges.plot.width).toBeLessThanOrEqual(
        edges.chart.right - edges.chart.left,
      )
      expect(edges.plot.width).toBeGreaterThan(300)
    }
    const manage = page.getByRole('link', {
      name: 'Manage',
      exact: true,
    })
    await expect(manage).toHaveAttribute('title', 'Manage challenges')
    expect(
      await manage.evaluate((element) =>
        Boolean(element.parentElement?.querySelector('a[aria-current="page"]')),
      ),
    ).toBe(true)
    expect(
      await manage.evaluate((element) =>
        Boolean(element.parentElement?.closest('a,button')),
      ),
    ).toBe(false)
    const manageBox = (await manage.boundingBox())!
    expect(manageBox.width).toBeGreaterThanOrEqual(44)
    expect(manageBox.height).toBeGreaterThanOrEqual(44)
    await expect(manage).toHaveCSS('font-size', '12.6px')
    await page.getByRole('link', { name: /Group · testtest/ }).focus()
    await page.keyboard.press('Tab')
    await expect(manage).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: 'Manage group challenges.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Manage members', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Manage invitations', exact: true }),
    ).toBeVisible()
    await page.goto(url)
    await expect(
      page.locator('.group-history-workspace svg').first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeEnabled()
    await page.screenshot({
      path: testInfo.outputPath(`group-overview-${width}.png`),
      fullPage: true,
    })
    if (width === 390) {
      owner = false
      await page.goto(url)
      await expect(
        page.getByRole('link', { name: /Group · testtest/ }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Manage', exact: true }),
      ).toHaveCount(0)
    }
  })
}

test('group selector matches the member tabs container surface on Charts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await installGroupFixtures(page, false, true)
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=${encodeURIComponent(`/group?challenge=${ownGroupId}`)}`,
  )
  await page
    .getByRole('navigation', { name: 'Group sections' })
    .getByRole('link', { name: 'Charts', exact: true })
    .click()

  const selector = page.locator('[aria-label="Challenge contexts"] > div')
  const memberTabs = page.locator('.group-history-workspace > .sticky')
  await expect(selector).toBeVisible()
  await expect(memberTabs).toBeVisible()
  const chartContextWidths = await page
    .getByRole('navigation', { name: 'Challenge contexts' })
    .evaluate((navigation) => ({
      link: navigation.querySelector('a')!.getBoundingClientRect().width,
      row: navigation.querySelector(':scope > div')!.getBoundingClientRect()
        .width,
    }))
  expect(chartContextWidths.link).toBeLessThan(chartContextWidths.row * 0.9)
  const [selectorBackground, memberTabsBackground] = await Promise.all([
    selector.evaluate((element) => getComputedStyle(element).backgroundColor),
    memberTabs.evaluate((element) => getComputedStyle(element).backgroundColor),
  ])
  expect(selectorBackground).toBe(memberTabsBackground)
})

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'phone', width: 390 },
]) {
  for (const memberCount of [1, 2, 4]) {
    test(`Records columns fill the container for ${memberCount} members on ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 })
      await installGroupFixtures(page)
      await page.route(
        `${supabaseRestUrl}/rpc/get_group_chart_history`,
        async (route) => {
          const rows = Array.from({ length: memberCount }, (_, index) =>
            ['2026-09-20', '2026-09-22'].map((recorded_date, dayIndex) => ({
              member_key: `layout-member-${index + 1}`,
              display_name: `Member ${index + 1}`,
              recorded_date,
              weight_kg: 90 - index - dayIndex,
            })),
          ).flat()
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(rows),
          })
        },
      )
      await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
      await page
        .getByRole('navigation', { name: 'Group sections' })
        .getByRole('link', { name: 'Records', exact: true })
        .click()

      const table = page.getByRole('table', {
        name: 'Shared group weight history',
      })
      await expect(table.getByRole('columnheader')).toHaveCount(memberCount + 1)
      const metrics = await table.evaluate((element) => {
        const headers = Array.from(element.querySelectorAll('thead th'))
        const bounds = element.getBoundingClientRect()
        return {
          tableWidth: bounds.width,
          containerWidth: element.parentElement!.clientWidth,
          scrollWidth: element.parentElement!.scrollWidth,
          columnWidths: headers.map(
            (header) => header.getBoundingClientRect().width,
          ),
        }
      })
      expect(metrics.tableWidth).toBeGreaterThanOrEqual(
        metrics.containerWidth - 1,
      )
      expect(
        Math.max(...metrics.columnWidths.slice(1)) -
          Math.min(...metrics.columnWidths.slice(1)),
      ).toBeLessThan(1)

      const memberTabMetrics = await page
        .getByRole('tablist', { name: 'Shared group members' })
        .evaluate((element) => {
          const tabs = Array.from(element.querySelectorAll('[role="tab"]'))
          const widths = tabs.map((tab) => tab.getBoundingClientRect().width)
          return {
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            tabCount: tabs.length,
            widths,
          }
        })
      expect(
        Math.max(...memberTabMetrics.widths) -
          Math.min(...memberTabMetrics.widths),
      ).toBeLessThan(1)
      const memberContentCenters = await page
        .getByRole('tablist', { name: 'Shared group members' })
        .evaluate((element) =>
          Array.from(element.querySelectorAll('[role="tab"]')).map((tab) => {
            const content = tab.querySelector<HTMLElement>(
              '[data-member-tab-content]',
            )!
            const tabBounds = tab.getBoundingClientRect()
            const contentBounds = content.getBoundingClientRect()
            return {
              horizontalOffset: Math.abs(
                tabBounds.left +
                  tabBounds.width / 2 -
                  (contentBounds.left + contentBounds.width / 2),
              ),
              verticalOffset: Math.abs(
                tabBounds.top +
                  tabBounds.height / 2 -
                  (contentBounds.top + contentBounds.height / 2),
              ),
            }
          }),
        )
      expect(
        Math.max(
          ...memberContentCenters.map((center) => center.horizontalOffset),
        ),
      ).toBeLessThanOrEqual(2)
      expect(
        Math.max(
          ...memberContentCenters.map((center) => center.verticalOffset),
        ),
      ).toBeLessThanOrEqual(2)
      if (viewport.width === 390 && memberCount === 4) {
        expect(memberTabMetrics.scrollWidth).toBeGreaterThan(
          memberTabMetrics.clientWidth,
        )
        expect(Math.min(...memberTabMetrics.widths)).toBeGreaterThanOrEqual(104)
      } else {
        expect(memberTabMetrics.scrollWidth).toBeLessThanOrEqual(
          memberTabMetrics.clientWidth,
        )
      }

      const contextFilter = page.getByRole('navigation', {
        name: 'Challenge contexts',
      })
      const filterGeometry = await contextFilter.evaluate((navigation) => {
        const list = navigation.querySelector('ul')!
        const listItem = list.querySelector('li')!
        const link = listItem.querySelector('a')!
        return {
          listWidth: list.getBoundingClientRect().width,
          itemWidth: listItem.getBoundingClientRect().width,
          linkWidth: link.getBoundingClientRect().width,
          linkCenter:
            link.getBoundingClientRect().left +
            link.getBoundingClientRect().width / 2,
          textCenter: (() => {
            const range = document.createRange()
            range.selectNodeContents(link)
            const bounds = range.getBoundingClientRect()
            return bounds.left + bounds.width / 2
          })(),
          itemCount: list.children.length,
          scrollWidth: list.parentElement!.scrollWidth,
          clientWidth: list.parentElement!.clientWidth,
        }
      })
      expect(filterGeometry.itemWidth).toBeGreaterThanOrEqual(
        filterGeometry.listWidth / filterGeometry.itemCount - 1,
      )
      expect(filterGeometry.linkWidth).toBeCloseTo(filterGeometry.itemWidth, 0)
      expect(
        Math.abs(filterGeometry.linkCenter - filterGeometry.textCenter),
      ).toBeLessThanOrEqual(2)
      expect(filterGeometry.scrollWidth).toBeLessThanOrEqual(
        filterGeometry.clientWidth,
      )

      const recordPairWidths = await table
        .locator('tbody td')
        .evaluateAll((cells) =>
          cells.flatMap((cell) => {
            const pair = cell.querySelector<HTMLElement>('[data-record-pair]')
            return pair
              ? [cell.clientWidth - pair.getBoundingClientRect().width]
              : []
          }),
        )
      expect(recordPairWidths.length).toBeGreaterThan(0)
      expect(Math.max(...recordPairWidths)).toBeLessThanOrEqual(10)
      expect(Math.min(...recordPairWidths)).toBeGreaterThanOrEqual(-1)
      const recordBoxGeometry = await table
        .locator('tbody td [data-record-pair]')
        .evaluateAll((pairs) =>
          pairs.map((pair) => {
            const layout = pair.querySelector('[data-record-pair-layout]')!
            const comparison = pair.querySelector('[data-record-comparison]')!
            const card = pair.querySelector('[class~="record-weight-box"]')!
            const comparisonBounds = comparison.getBoundingClientRect()
            const cardBounds = card.getBoundingClientRect()
            const pairBounds = pair.getBoundingClientRect()
            const layoutBounds = layout.getBoundingClientRect()
            const comparisonText = comparison.querySelector('span')!
            const textRange = document.createRange()
            textRange.selectNodeContents(comparisonText)
            const comparisonTextBounds = textRange.getBoundingClientRect()
            const visibleChildren = Array.from(card.children).filter(
              (child) => !child.classList.contains('sr-only'),
            )
            const bounds = visibleChildren.map((child) =>
              child.getBoundingClientRect(),
            )
            const left = Math.min(...bounds.map((box) => box.left))
            const right = Math.max(...bounds.map((box) => box.right))
            return {
              sideBySide: comparisonBounds.right <= cardBounds.left,
              pairContainsBoth:
                comparisonBounds.left >= pairBounds.left &&
                cardBounds.right <= pairBounds.right,
              outerContainerStyled:
                getComputedStyle(pair).borderTopWidth !== '0px' &&
                getComputedStyle(pair).borderTopLeftRadius !== '0px' &&
                getComputedStyle(pair).paddingTop !== '0px' &&
                getComputedStyle(pair).backgroundColor !== 'rgba(0, 0, 0, 0)',
              innerLayoutWithinContainer:
                layoutBounds.left >= pairBounds.left &&
                layoutBounds.right <= pairBounds.right,
              comparisonCenterOffset: Math.abs(
                comparisonBounds.left +
                  comparisonBounds.width / 2 -
                  (comparisonTextBounds.left + comparisonTextBounds.width / 2),
              ),
              cardCenterOffset: Math.abs(
                cardBounds.left + cardBounds.width / 2 - (left + right) / 2,
              ),
            }
          }),
        )
      expect(recordBoxGeometry.every((geometry) => geometry.sideBySide)).toBe(
        true,
      )
      expect(
        recordBoxGeometry.every((geometry) => geometry.pairContainsBoth),
      ).toBe(true)
      expect(
        recordBoxGeometry.every((geometry) => geometry.outerContainerStyled),
      ).toBe(true)
      expect(
        recordBoxGeometry.every(
          (geometry) => geometry.innerLayoutWithinContainer,
        ),
      ).toBe(true)
      expect(
        Math.max(
          ...recordBoxGeometry.map(
            (geometry) => geometry.comparisonCenterOffset,
          ),
        ),
      ).toBeLessThanOrEqual(3)
      expect(
        Math.max(
          ...recordBoxGeometry.map((geometry) => geometry.cardCenterOffset),
        ),
      ).toBeLessThanOrEqual(3)
      const memberHeaderCenters = await table
        .locator('thead th:not(:first-child)')
        .evaluateAll((headers) =>
          headers.map((header) => {
            const range = document.createRange()
            range.selectNodeContents(header)
            const textBounds = range.getBoundingClientRect()
            const headerBounds = header.getBoundingClientRect()
            return Math.abs(
              headerBounds.left +
                headerBounds.width / 2 -
                (textBounds.left + textBounds.width / 2),
            )
          }),
        )
      expect(Math.max(...memberHeaderCenters)).toBeLessThanOrEqual(2)
      if (memberCount === 1 || memberCount === 4) {
        await page.screenshot({
          path: test
            .info()
            .outputPath(`records-${memberCount}-members-${viewport.width}.png`),
          fullPage: true,
        })
      }
      if (viewport.width === 1280) {
        expect(metrics.tableWidth).toBeCloseTo(metrics.containerWidth, 0)
      } else {
        expect(metrics.scrollWidth).toBeGreaterThan(metrics.containerWidth)
        expect(
          Math.min(...metrics.columnWidths.slice(1)),
        ).toBeGreaterThanOrEqual(224)
      }
    })
  }
}

test('shows the challenge owner badge only in Members and fits on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await installGroupFixtures(
    page,
    true,
    true,
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    otherViewerId,
  )
  await page.goto(
    `/e2e/fixtures/today-harness.html?scenario=group&user=${viewerId}&route=${encodeURIComponent(`/group?challenge=${ownGroupId}`)}`,
  )

  const sections = page.getByRole('navigation', { name: 'Group sections' })
  await sections.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Member progress', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Same display name Owner',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Same display name', exact: true }),
  ).toBeVisible()
  const ownerBadge = page.getByText('Owner', { exact: true })
  await expect(ownerBadge).toHaveCount(1)
  const badgeMetrics = await ownerBadge.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      fontSize: getComputedStyle(element).fontSize,
      height: bounds.height,
    }
  })
  expect(badgeMetrics.fontSize).toBe('9px')
  expect(badgeMetrics.height).toBeGreaterThanOrEqual(20)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)

  await sections.getByRole('link', { name: 'Charts', exact: true }).click()
  await expect(page.getByText('Owner', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('list', { name: 'Group chart legend' }),
  ).not.toContainText('Owner')
})

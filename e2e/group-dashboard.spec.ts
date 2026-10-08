import { expect, test, type Page } from '@playwright/test'

const challengeId = 'e2e-challenge'
const supabaseRestUrl = 'https://group-preview.supabase.co/rest/v1'

function shiftDate(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function installGroupFixtures(page: Page, multiple = false) {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  await page.route(`${supabaseRestUrl}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname === '/rest/v1/challenges') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            created_at: '2026-09-17T10:00:00.000Z',
            created_by: 'e2e-owner',
            description: null,
            end_date: '2026-12-01',
            id: challengeId,
            name: 'E2E authorized group',
            owner_id: 'e2e-owner',
            start_date: '2026-09-17',
            status: 'active',
            target_weight_kg: null,
            updated_at: '2026-09-17T10:00:00.000Z',
          },
          ...(multiple
            ? [
                {
                  created_at: '2026-09-17T10:00:00.000Z',
                  created_by: 'e2e-owner',
                  description: null,
                  end_date: '2026-12-01',
                  id: 'e2e-second-group',
                  name: 'Second authorized group',
                  owner_id: 'e2e-owner',
                  start_date: '2026-09-17',
                  status: 'active',
                  target_weight_kg: null,
                  updated_at: '2026-09-17T10:00:00.000Z',
                },
              ]
            : []),
        ]),
      })
      return
    }

    if (url.pathname === '/rest/v1/rpc/get_group_progress_summary') {
      const body = request.postDataJSON() as {
        target_challenge_id: string
        target_current_sunday: string
      }
      expect([
        challengeId,
        ...(multiple ? ['e2e-second-group'] : []),
      ]).toContain(body.target_challenge_id)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            active_participant_count: 3,
            average_completion_percentage:
              body.target_challenge_id === challengeId ? 42.5 : 73.2,
            challenge_id: body.target_challenge_id,
            current_sunday: body.target_current_sunday,
            eligible_participant_count: 2,
            participants_with_progress_count: 2,
            participants_with_recorded_weight_count: 3,
            previous_sunday: shiftDate(body.target_current_sunday, -7),
            reached_target_count: 1,
            weekly_winner_count: 2,
            weekly_winner_names:
              body.target_challenge_id === challengeId
                ? ['Ava', 'Ben']
                : ['Jo', 'Kim'],
            private_note: 'fixture private note must never render',
            raw_weigh_ins: [{ weight_kg: 91.5 }],
          },
        ]),
      })
      return
    }

    if (url.pathname === '/rest/v1/rpc/get_provisional_group_leader_summary') {
      const body = request.postDataJSON() as {
        target_challenge_id: string
        target_current_date: string
      }
      expect([
        challengeId,
        ...(multiple ? ['e2e-second-group'] : []),
      ]).toContain(body.target_challenge_id)
      const currentDate = new Date(`${body.target_current_date}T00:00:00.000Z`)
      const mondayOffset = (currentDate.getUTCDay() + 6) % 7
      const currentWeekStart = shiftDate(
        body.target_current_date,
        -mondayOffset,
      )
      const previousSunday = shiftDate(currentWeekStart, -1)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            active_participant_count: 3,
            challenge_id: body.target_challenge_id,
            current_week_end: shiftDate(currentWeekStart, 6),
            current_week_start: currentWeekStart,
            eligible_participant_count: 2,
            leader_count: 2,
            leader_latest_dates: [
              body.target_current_date,
              body.target_current_date,
            ],
            leader_names:
              body.target_challenge_id === challengeId
                ? ['Ava', 'Ben']
                : ['Jo', 'Kim'],
            previous_sunday: previousSunday,
            state: 'leaders',
            leader_email: 'private@example.invalid',
            private_note: 'fixture leader note must never render',
            raw_history: [{ weight_kg: 91.5 }],
          },
        ]),
      })
      return
    }

    await route.fulfill({ status: 404, body: 'Unexpected fixture request' })
  })
  return requests
}

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`pill switch and direct refresh keep distinct authorized group records on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    await expect(contexts).toHaveCount(1)
    const row = (await contexts.boundingBox())!
    const heading = (await page
      .getByRole('heading', { name: 'Group dashboard' })
      .boundingBox())!
    expect(row.y + row.height).toBeLessThan(heading.y)
    const second = contexts.getByRole('link', {
      name: 'Group · Second authorized group',
      exact: true,
    })
    await second.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
    await expect(page.getByText('42.5%', { exact: true })).toHaveCount(0)
    await expect(
      contexts.getByRole('link', { name: /Second authorized group/ }),
    ).toHaveAttribute('aria-current', 'page')
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
    const requests = await installGroupFixtures(page)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')

    await expect(
      page.getByRole('heading', { name: 'Group dashboard' }),
    ).toBeVisible()
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    await expect(page.getByText('Shared provisional leaders')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).toContainText('Ava')
    await expect(
      page.getByRole('list', { name: 'Weekly winners' }),
    ).toContainText('Ben')

    const historyPanel = page.getByRole('region', {
      name: 'Group chart and weigh-in history',
    })
    await expect(historyPanel).toHaveAttribute('aria-disabled', 'true')
    await expect(historyPanel).toContainText('Not available yet · Chapter 16')
    const contrast = await historyPanel.evaluate((panel) => {
      const label = panel.querySelector('p')
      const body = panel.querySelector('#group-history-unavailable-copy')
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
    await expect(historyPanel.getByRole('img')).toHaveCount(0)
    await expect(historyPanel.getByRole('table')).toHaveCount(0)
    await expect(historyPanel.getByRole('button')).toHaveCount(0)

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
}

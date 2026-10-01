import { expect, test, type Page } from '@playwright/test'

const challengeId = 'e2e-challenge'
const supabaseRestUrl = 'https://group-preview.supabase.co/rest/v1'

function shiftDate(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function installGroupFixtures(page: Page) {
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
        ]),
      })
      return
    }

    if (url.pathname === '/rest/v1/rpc/get_group_progress_summary') {
      const body = request.postDataJSON() as {
        target_challenge_id: string
        target_current_sunday: string
      }
      expect(body.target_challenge_id).toBe(challengeId)
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            active_participant_count: 3,
            average_completion_percentage: 42.5,
            challenge_id: challengeId,
            current_sunday: body.target_current_sunday,
            eligible_participant_count: 2,
            participants_with_progress_count: 2,
            participants_with_recorded_weight_count: 3,
            previous_sunday: shiftDate(body.target_current_sunday, -7),
            reached_target_count: 1,
            weekly_winner_count: 2,
            weekly_winner_names: ['Ava', 'Ben'],
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
      expect(body.target_challenge_id).toBe(challengeId)
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
            challenge_id: challengeId,
            current_week_end: shiftDate(currentWeekStart, 6),
            current_week_start: currentWeekStart,
            eligible_participant_count: 2,
            leader_count: 2,
            leader_latest_dates: [
              body.target_current_date,
              body.target_current_date,
            ],
            leader_names: ['Ava', 'Ben'],
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

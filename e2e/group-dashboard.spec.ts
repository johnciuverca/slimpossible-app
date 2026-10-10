import { expect, test, type Page } from '@playwright/test'

const challengeId = 'e2e-challenge'
const supabaseRestUrl = 'https://group-preview.supabase.co/rest/v1'

function shiftDate(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function installGroupFixtures(
  page: Page,
  multiple = false,
  ownEntries = false,
) {
  const requests: string[] = []
  let ownWeight: number | null = 88.5
  page.on('request', (request) => requests.push(request.url()))

  await page.route(`${supabaseRestUrl}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (ownEntries && url.pathname === '/rest/v1/participants') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'own-membership',
            challenge_id: challengeId,
            user_id: 'e2e-user',
            display_name: 'Own viewer',
            starting_weight_kg: 100,
            target_weight_kg: 80,
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
            joined_at: '2026-09-01T00:00:00Z',
          },
          {
            id: 'own-second-membership',
            challenge_id: 'e2e-second-group',
            user_id: 'e2e-user',
            display_name: 'Own viewer',
            starting_weight_kg: 100,
            target_weight_kg: 80,
            status: 'active',
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
            joined_at: '2026-09-01T00:00:00Z',
          },
        ]),
      })
      return
    }
    const ownRow = () => ({
      id: 'disposable-own-entry',
      recorded_date: '2026-09-22',
      weight_kg: ownWeight,
      note: 'Author-only disposable private note',
      shared_challenge_ids: [challengeId, 'e2e-second-group'],
    })
    if (
      ownEntries &&
      url.pathname === '/rest/v1/rpc/list_my_personal_weigh_ins'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(ownWeight === null ? [] : [ownRow()]),
      })
      return
    }
    if (ownEntries && url.pathname === '/rest/v1/rpc/save_personal_weigh_in') {
      const body = request.postDataJSON()
      expect(body.target_weigh_in_id).toBe('disposable-own-entry')
      expect(body.target_note).toBe('Author-only disposable private note')
      expect(body.target_shared_challenge_ids).toEqual([
        challengeId,
        'e2e-second-group',
      ])
      ownWeight = body.target_weight_kg
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([ownRow()]),
      })
      return
    }
    if (
      ownEntries &&
      url.pathname === '/rest/v1/rpc/delete_personal_weigh_in'
    ) {
      expect(request.postDataJSON()).toEqual({
        target_weigh_in_id: 'disposable-own-entry',
      })
      ownWeight = null
      await route.fulfill({ contentType: 'application/json', body: 'true' })
      return
    }

    if (url.pathname === '/rest/v1/rpc/get_group_chart_history') {
      const { target_challenge_id } = request.postDataJSON() as {
        target_challenge_id: string
      }
      const name = target_challenge_id === challengeId ? 'Ava' : 'Jo'
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            member_key: 'opaque-member-a',
            display_name: name,
            recorded_date: '2026-09-20',
            weight_kg: 90,
            note: 'fixture private note must never render',
            email: 'private@example.invalid',
          },
          ...(ownEntries && ownWeight === null
            ? []
            : [
                {
                  member_key: 'opaque-member-a',
                  display_name: name,
                  recorded_date: '2026-09-22',
                  weight_kg: ownEntries ? ownWeight : 88.5,
                },
              ]),
          {
            member_key: 'opaque-member-b',
            display_name: name,
            recorded_date: '2026-09-20',
            weight_kg: 70,
          },
          {
            member_key: 'opaque-member-b',
            display_name: name,
            recorded_date: '2026-09-21',
            weight_kg: 71,
          },
        ]),
      })
      return
    }

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
  test(`only own shared entries edit/delete and refresh all selected groups on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 700 })
    const requests = await installGroupFixtures(page, true, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    const own = page.getByRole('list', {
      name: 'Your own shared group entries',
    })
    const matrix = page.getByRole('table', {
      name: 'Shared group weight history',
    })
    await expect(
      own.getByRole('button', { name: 'Edit weight 2026-09-22' }),
    ).toBeVisible()
    await expect(own.getByRole('button')).toHaveCount(2)
    await expect(matrix.getByRole('button')).toHaveCount(0)
    // Duplicate display names must never establish ownership. Opaque tabs are
    // read-only; author actions are conservatively available in All members only.
    for (const name of ['Ava (member 1)', 'Ava (member 2)']) {
      const member = page.getByRole('tab', { name, exact: true })
      await member.focus()
      await page.keyboard.press('Enter')
      await expect(member).toHaveAttribute('aria-selected', 'true')
      await expect(own).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Edit weight 2026-09-22' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Delete 2026-09-22' }),
      ).toHaveCount(0)
      await expect(matrix.getByRole('button')).toHaveCount(0)
    }
    await page.keyboard.press('Home')
    await expect(
      page.getByRole('tab', { name: 'All members', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(own.getByRole('button')).toHaveCount(2)
    await expect(
      page.getByText('Author-only disposable private note', { exact: true }),
    ).toHaveCount(0)
    await own.getByRole('button', { name: 'Edit weight 2026-09-22' }).click()
    const editor = page.getByRole('dialog', {
      name: 'Edit weight',
      exact: true,
    })
    await expect(editor.getByLabel('Weight in kg')).toBeFocused()
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('88.5')
    await expect(editor.getByLabel('Private note (optional)')).toHaveValue(
      'Author-only disposable private note',
    )
    await expect(editor.getByRole('checkbox')).toHaveCount(2)
    await expect(editor.getByRole('checkbox').first()).toBeChecked()
    await expect(editor.getByRole('checkbox').last()).toBeChecked()
    await editor.getByLabel('Weight in kg').fill('87')
    await editor.getByRole('button', { name: 'Update weight' }).click()
    await expect(own.getByText('87 kg', { exact: false })).toBeVisible()
    await expect(matrix.getByText('87 kg', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeFocused()
    await expect(
      page.getByText('Author-only disposable private note', { exact: true }),
    ).toHaveCount(0)
    const countBefore = requests.filter((url) =>
      url.includes('get_group_chart_history'),
    ).length
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'My progress', exact: true })
      .click()
    const personalActions = page.getByRole('list', {
      name: 'Your own personal entry actions',
    })
    await personalActions
      .getByRole('button', { name: 'Edit weight 2026-09-22' })
      .click()
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('87')
    await expect(editor.getByLabel('Private note (optional)')).toHaveValue(
      'Author-only disposable private note',
    )
    await page.keyboard.press('Escape')
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Group', exact: true })
      .click()
    await own.getByRole('button', { name: 'Delete 2026-09-22' }).click()
    const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
    await expect(deletion).toContainText('87 kg recorded 2026-09-22')
    await expect(deletion).toContainText('ALL shared groups')
    await expect(deletion.getByRole('form')).toHaveCount(0)
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(
      own.getByRole('button', { name: 'Delete 2026-09-22' }),
    ).toBeFocused()
    await expect(matrix.getByText('87 kg', { exact: true })).toBeVisible()
    await own.getByRole('button', { name: 'Delete 2026-09-22' }).click()
    await deletion
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(
      page.getByText('No own entries shared with this group.'),
    ).toBeVisible()
    await expect(matrix.getByText('87 kg', { exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Record weight', exact: true }),
    ).toBeFocused()
    expect(
      requests.filter((url) => url.includes('get_group_chart_history')).length,
    ).toBeGreaterThan(countBefore)
    await page
      .getByRole('navigation', { name: 'Challenge contexts' })
      .getByRole('link', {
        name: 'Group · Second authorized group',
        exact: true,
      })
      .click()
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
    await expect(
      page.getByText('No own entries shared with this group.'),
    ).toBeVisible()
    await expect(matrix.getByText('87 kg', { exact: true })).toHaveCount(0)
    await expect(matrix.getByText('70 kg', { exact: true })).toBeVisible()
  })
  test(`spreadsheet member tabs and sticky navigation stay usable on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    const requests = await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    const table = page.getByRole('table', {
      name: 'Shared group weight history',
    })
    await expect(table.getByRole('columnheader')).toHaveText([
      'Recorded date',
      'Ava (member 1) (kg)',
      'Ava (member 2) (kg)',
    ])
    const missing = table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: '2026-09-21' }) })
    await expect(missing.getByRole('cell')).toHaveText([
      '—',
      '71 kg; change from first shared entry +1 kg',
    ])
    const tabs = page.getByRole('tablist', { name: 'Shared group members' })
    const all = tabs.getByRole('tab', { name: 'All members' })
    await all.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      tabs.getByRole('tab', { name: 'Ava (member 1)' }),
    ).toBeFocused()
    await expect(table.getByRole('columnheader')).toHaveCount(2)
    await expect(table).toContainText('88.5 kg')
    await expect(table).not.toContainText('70 kg')
    await expect(page.getByRole('img').locator('circle')).toHaveCount(2)
    await page.keyboard.press('End')
    await expect(
      tabs.getByRole('tab', { name: 'Ava (member 2)' }),
    ).toBeFocused()
    await expect(table).toContainText('71 kg')
    await expect(table).not.toContainText('88.5 kg')
    await page.keyboard.press('Home')
    await expect(all).toBeFocused()
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
    const navigation = page.locator('.group-history-workspace > .sticky')
    await expect
      .poll(() =>
        navigation.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(0)
    const navBounds = await navigation.boundingBox()
    expect(navBounds!.height).toBeLessThan(450)
    const focusBounds = await weights.boundingBox()
    expect(focusBounds!.y).toBeGreaterThanOrEqual(
      navBounds!.y + navBounds!.height,
    )
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
    await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Shared group weight history' }),
    ).toContainText('Ava')
    const contexts = page.getByRole('navigation', {
      name: 'Challenge contexts',
    })
    await expect(contexts).toHaveCount(1)
    const row = (await contexts.boundingBox())!
    const heading = (await page
      .getByRole('heading', { name: 'Group', exact: true })
      .boundingBox())!
    expect(heading.y + heading.height).toBeLessThan(row.y)
    const second = contexts.getByRole('link', {
      name: 'Group · Second authorized group',
      exact: true,
    })
    await second.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
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
      page.getByRole('heading', { name: 'Group', exact: true }),
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
    await expect(historyPanel.getByRole('table')).toContainText('88.5 kg')
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
    await expect(historyPanel.getByRole('img')).toHaveCount(1)
    await expect(historyPanel.getByRole('table')).toHaveCount(1)
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

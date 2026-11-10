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
      })
      return
    }
    const ownRow = () => ({
      id: 'disposable-own-entry',
      recorded_date: '2026-09-22',
      weight_kg: ownWeight,
      note: 'Author-only disposable private note',
      shared_challenge_ids: [challengeId, secondId],
    })
    if (
      ownEntries &&
      url.pathname === '/rest/v1/rpc/list_my_personal_weigh_ins'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          ownWeight === null
            ? []
            : [
                ownRow(),
                ...(privateEntryAtEstimatedDate ? [privateEntry()] : []),
                ...(ownEstimatedSaved
                  ? [
                      {
                        id: 'disposable-own-estimated-entry',
                        recorded_date: '2026-09-21',
                        weight_kg: ownEstimatedSavedWeight,
                        note: '',
                        shared_challenge_ids: ownEstimatedSharedChallengeIds,
                      },
                    ]
                  : []),
                ...(priorOwnWeight === undefined
                  ? []
                  : [
                      {
                        ...ownRow(),
                        id: 'disposable-own-reached-target',
                        recorded_date: '2026-09-21',
                        weight_kg: priorOwnWeight,
                      },
                    ]),
                ...(differentWeights
                  ? [
                      {
                        ...ownRow(),
                        id: 'disposable-own-baseline',
                        recorded_date: '2026-09-20',
                        weight_kg: 9,
                      },
                    ]
                  : []),
              ],
        ),
      })
      return
    }
    if (url.pathname === '/rest/v1/rpc/change_my_group_target') {
      const body = request.postDataJSON() as {
        target_challenge_id: string
        target_target_weight_kg: number
      }
      expect(body.target_challenge_id).toBe(challengeId)
      if (targetChangeControl?.hold) {
        await new Promise<void>((resolve) => {
          targetChangeControl.release = resolve
        })
      }
      ownTarget = body.target_target_weight_kg
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            challenge_id: challengeId,
            starting_weight_kg: 100,
            target_weight_kg: ownTarget,
            previous_target_weight_kg: null,
            previous_target_achieved_on: null,
          },
        ]),
      })
      return
    }
    if (url.pathname === '/rest/v1/rpc/correct_my_enrollment_starting_weight') {
      const body = request.postDataJSON() as {
        target_challenge_id: string
        target_starting_weight_kg: number
      }
      expect(body).toEqual({
        target_challenge_id: challengeId,
        target_starting_weight_kg: 110,
      })
      if (startingWeightCorrectionControl?.hold) {
        await new Promise<void>((resolve) => {
          startingWeightCorrectionControl.release = resolve
        })
      }
      ownStartingWeight = body.target_starting_weight_kg
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            challenge_id: challengeId,
            starting_weight_kg: ownStartingWeight,
            target_weight_kg: ownTarget,
          },
        ]),
      })
      return
    }
    if (ownEntries && url.pathname === '/rest/v1/rpc/save_personal_weigh_in') {
      const body = request.postDataJSON() as {
        target_weigh_in_id: string | null
        target_recorded_date: string
        target_weight_kg: number
        target_note: string
        target_shared_challenge_ids: string[]
      }
      if (body.target_weigh_in_id === null) {
        expect(body.target_recorded_date).toBe('2026-09-21')
        expect(body.target_weight_kg).toBeCloseTo(estimatedOwnWeight())
        expect(body.target_note).toBeNull()
        expect(body.target_shared_challenge_ids).toEqual([challengeId])
        if (options.duplicateEstimateOnSave && !privateEntryAtEstimatedDate) {
          privateEntryAtEstimatedDate = true
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              code: '23505',
              message: 'duplicate key value violates unique constraint',
            }),
          })
          return
        }
        ownEstimatedSaved = true
        ownEstimatedSavedWeight = body.target_weight_kg
        ownEstimatedSharedChallengeIds = body.target_shared_challenge_ids
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'disposable-own-estimated-entry',
              recorded_date: '2026-09-21',
              weight_kg: ownEstimatedSavedWeight,
              note: '',
              shared_challenge_ids: ownEstimatedSharedChallengeIds,
            },
          ]),
        })
        return
      }
      if (body.target_weigh_in_id === 'disposable-own-private-entry') {
        expect(body.target_recorded_date).toBe('2026-09-21')
        expect(body.target_weight_kg).toBe(84.5)
        expect(body.target_note).toBe(privateEntryNote)
        expect(body.target_shared_challenge_ids).toEqual(
          options.privateEntrySharedWithOtherGroup
            ? [secondId, challengeId]
            : [challengeId],
        )
        privateEntryWeight = body.target_weight_kg
        privateEntrySharedChallengeIds = body.target_shared_challenge_ids
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([privateEntry()]),
        })
        return
      }
      expect(body.target_weigh_in_id).toBe('disposable-own-entry')
      expect(body.target_recorded_date).toBe('2026-09-22')
      expect(body.target_note).toBe('Author-only disposable private note')
      expect(body.target_shared_challenge_ids).toEqual([challengeId, secondId])
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
      const ownKey = ownEntries
        ? memberKey(target_challenge_id, viewerId)
        : 'opaque-member-a'
      const otherKey = ownEntries
        ? memberKey(target_challenge_id, otherViewerId)
        : 'opaque-member-b'
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            member_key: ownKey,
            display_name: name,
            recorded_date: '2026-09-20',
            weight_kg: differentWeights ? 9 : 90,
            note: 'fixture private note must never render',
            email: 'private@example.invalid',
          },
          ...(ownEntries && ownWeight === null
            ? []
            : [
                {
                  member_key: ownKey,
                  display_name: name,
                  recorded_date: '2026-09-22',
                  weight_kg: ownEntries ? ownWeight : 88.5,
                },
                ...(ownEntries &&
                ownEstimatedSaved &&
                ownEstimatedSharedChallengeIds.includes(target_challenge_id)
                  ? [
                      {
                        member_key: ownKey,
                        display_name: name,
                        recorded_date: '2026-09-21',
                        weight_kg: estimatedOwnWeight(),
                      },
                    ]
                  : []),
                ...(ownEntries &&
                privateEntryAtEstimatedDate &&
                privateEntrySharedChallengeIds.includes(target_challenge_id)
                  ? [
                      {
                        member_key: ownKey,
                        display_name: name,
                        recorded_date: '2026-09-21',
                        weight_kg: privateEntryWeight,
                      },
                    ]
                  : []),
              ]),
          {
            member_key: otherKey,
            display_name: name,
            recorded_date: '2026-09-20',
            weight_kg: differentWeights ? 95.1 : 70,
          },
          {
            member_key: otherKey,
            display_name: name,
            recorded_date: '2026-09-21',
            weight_kg: differentWeights ? 105.25 : 71,
          },
          ...(differentWeights
            ? [99.95, 1000.5, 9, 80].map((weight, index) => ({
                member_key: `layout-readonly-${index}`,
                display_name: `Fixture member ${index + 1}`,
                recorded_date: '2026-09-22',
                weight_kg: weight,
              }))
            : []),
          ...(ownEntries
            ? [
                {
                  member_key: otherKey,
                  display_name: name,
                  recorded_date: '2026-09-22',
                  weight_kg: 88.5,
                },
              ]
            : []),
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
            owner_id: challengeOwnerId,
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
                  id: secondId,
                  name: 'Second authorized group',
                  owner_id: challengeOwnerId,
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

    if (
      ownEntries &&
      url.pathname === '/rest/v1/rpc/get_group_weigh_in_history'
    ) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          ...(ownWeight === null
            ? []
            : [
                {
                  display_name: 'Own member',
                  recorded_date: '2026-09-22',
                  weight_kg: ownWeight,
                  change_since_previous_kg: null,
                },
              ]),
          {
            display_name: 'Other member',
            recorded_date: '2026-09-22',
            weight_kg: 88.5,
            change_since_previous_kg: null,
            note: 'Other member private note must never render',
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
      expect([challengeId, ...(multiple ? [secondId] : [])]).toContain(
        body.target_challenge_id,
      )
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

    if (url.pathname === '/rest/v1/rpc/get_group_member_progress') {
      const body = request.postDataJSON() as { target_challenge_id: string }
      const ownKey = memberKey(body.target_challenge_id, viewerId)
      const otherKey = memberKey(body.target_challenge_id, otherViewerId)
      const ownCurrentWeight = ownWeight
      const ownRawSignedPercentage =
        ownCurrentWeight === null
          ? null
          : ownTarget === ownStartingWeight
            ? 100
            : ownCurrentWeight <= ownTarget
              ? 100
              : ((ownStartingWeight - ownCurrentWeight) /
                  (ownStartingWeight - ownTarget)) *
                100
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            member_key: ownKey,
            display_name:
              body.target_challenge_id === challengeId
                ? 'Same display name'
                : 'Second group member',
            starting_weight_kg:
              body.target_challenge_id === challengeId
                ? ownStartingWeight
                : 100,
            target_weight_kg: ownTarget,
            latest_recorded_date: '2026-09-22',
            completion_percentage:
              body.target_challenge_id === challengeId
                ? Math.round(
                    ((ownStartingWeight - (ownWeight ?? 90)) /
                      (ownStartingWeight - ownTarget)) *
                      1000,
                  ) / 10
                : 50,
            signed_display_percentage:
              body.target_challenge_id === challengeId
                ? ownRawSignedPercentage === null
                  ? null
                  : Math.round(
                      Math.max(-100, Math.min(100, ownRawSignedPercentage)) *
                        10,
                    ) / 10
                : 50,
            negative_progress_capped:
              body.target_challenge_id === challengeId &&
              ownRawSignedPercentage !== null &&
              ownRawSignedPercentage < -100,
            progress_state: 'in_progress',
            reached_target_milestones: [
              {
                target_weight_kg: 90,
                achieved_on: '2026-09-10',
                state: 'reached',
              },
            ],
          },
          {
            member_key: otherKey,
            display_name:
              body.target_challenge_id === challengeId
                ? 'Same display name'
                : 'Second group member',
            starting_weight_kg: 100,
            target_weight_kg: ownTarget,
            latest_recorded_date: '2026-09-22',
            completion_percentage: 50,
            signed_display_percentage: 50,
            negative_progress_capped: false,
            progress_state: 'in_progress',
            reached_target_milestones: [],
            private_note: 'hidden projection sentinel',
            raw_current_weight: 50,
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
      expect([challengeId, ...(multiple ? [secondId] : [])]).toContain(
        body.target_challenge_id,
      )
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
  return Object.assign(requests, {
    personalContextsHeld: () => personalContextsHeld,
    releasePersonalContexts: () =>
      releasePersonalContexts.splice(0).forEach((release) => release()),
  })
}

for (const layout of [
  { label: 'desktop', width: 1280, hasTouch: false },
  { label: 'mobile', width: 390, hasTouch: false },
  { label: 'coarse pointer', width: 390, hasTouch: true },
]) {
  test(`centered read-only labels and equal editable icon gaps on ${layout.label}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: layout.hasTouch,
      colorScheme: 'dark',
      viewport: { width: layout.width, height: 700 },
    })
    try {
      const page = await context.newPage()
      await installGroupFixtures(page, true, true, true)
      await page.goto(
        `http://127.0.0.1:4174/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
      )
      await page
        .getByRole('navigation', { name: 'Group sections' })
        .getByRole('link', { name: 'Charts', exact: true })
        .click()
      const matrix = page.getByRole('table', {
        name: 'Shared group weight history',
      })
      await expect(
        matrix.getByRole('button', { name: /^Edit weight/ }),
      ).toHaveCount(2)
      const cards = matrix.locator('td > div')
      await expect(cards).toHaveCount(9)
      const comparison = page.getByRole('img', {
        name: 'Weight (kg) — shared group history',
      })
      const viewBoxHeight = await comparison.evaluate((element) =>
        Number(element.getAttribute('viewBox')?.trim().split(/\s+/)[3]),
      )
      const plotRight = Number(
        await comparison.getAttribute('data-chart-plot-right'),
      )
      const outOfBoundsLabels = await comparison.locator('text').evaluateAll(
        (elements, { chartHeight, plotRight }) =>
          elements.flatMap((element) => {
            const box = (element as SVGGraphicsElement).getBBox()
            return box.x >= 0 &&
              box.x + box.width <= plotRight &&
              box.y >= 0 &&
              box.y + box.height <= chartHeight
              ? []
              : [
                  {
                    text: element.textContent,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                  },
                ]
          }),
        { chartHeight: viewBoxHeight, plotRight },
      )
      expect(outOfBoundsLabels).toEqual([])
      expect(
        (await matrix
          .getByRole('columnheader', { name: 'Recorded date' })
          .boundingBox())!.width,
      ).toBe(120)
      expect(
        (await matrix.getByRole('columnheader').nth(1).boundingBox())!.width,
      ).toBe(156)
      await expect(
        matrix.getByRole('rowheader', { name: '2026-09-22' }).locator('time'),
      ).toHaveAttribute('title', '2026-09-22')
      const boxes = await cards.evaluateAll((elements) =>
        elements.map((card) => {
          const bounds = card.getBoundingClientRect()
          const value = card.firstElementChild!
          const valueBounds = value.getBoundingClientRect()
          const buttons = Array.from(card.querySelectorAll('button')).map(
            (button) => {
              const box = button.getBoundingClientRect()
              const icon = button.querySelector('svg')!.getBoundingClientRect()
              return {
                offset: box.x - bounds.x,
                width: box.width,
                height: box.height,
                center: box.y + box.height / 2,
                iconLeft: icon.left,
                iconRight: icon.right,
                iconInsideTarget:
                  icon.left >= box.left && icon.right <= box.right,
              }
            },
          )
          return {
            width: bounds.width,
            height: bounds.height,
            value: value.textContent,
            fits: value.scrollWidth <= value.clientWidth,
            center: valueBounds.y + valueBounds.height / 2,
            valueWidth: valueBounds.width,
            leftPadding: valueBounds.left - bounds.left,
            rightPadding: bounds.right - valueBounds.right,
            unitRight: value.lastElementChild!.getBoundingClientRect().right,
            numberFontSize: getComputedStyle(value.firstElementChild!).fontSize,
            numberWidth: value.firstElementChild!.getBoundingClientRect().width,
            numberFits:
              value.firstElementChild!.scrollWidth <=
              value.firstElementChild!.clientWidth,
            unitOffset:
              value.lastElementChild!.getBoundingClientRect().x - bounds.x,
            numberAlign: getComputedStyle(value.firstElementChild!).textAlign,
            childCount: card.children.length,
            buttons,
          }
        }),
      )
      expect(boxes.map((box) => box.value)).toEqual(
        expect.arrayContaining([
          '9.00 kg',
          '95.10 kg',
          '105.25 kg',
          '99.95 kg',
          '1000.50 kg',
        ]),
      )
      for (const box of boxes) {
        if (box.buttons.length)
          expect(box.width).toBe(layout.hasTouch ? 148 : 124)
        else {
          expect(box.width).toBeCloseTo(box.valueWidth + 10, 1)
          expect(box.leftPadding).toBeCloseTo(box.rightPadding, 1)
          expect(box.numberFontSize).toBe('10px')
          expect(box.childCount).toBe(2)
        }
        expect(box.height).toBe(layout.hasTouch ? 48 : 40)
        if (box.buttons.length) {
          expect(box.valueWidth).toBe(50)
          expect(box.numberWidth).toBe(36)
          expect(box.buttons[0].iconLeft - box.unitRight).toBeCloseTo(
            box.buttons[1].iconLeft - box.buttons[0].iconRight,
            1,
          )
        }
        expect(box.numberFits).toBe(true)
        expect(box.numberAlign).toBe('right')
        expect(box.fits, `${box.value} fits the compact value area`).toBe(true)
        for (const button of box.buttons) {
          expect(button.iconInsideTarget).toBe(true)
          expect(button.width).toBe(layout.hasTouch ? 44 : 32)
          expect(button.height).toBeGreaterThanOrEqual(
            layout.hasTouch ? 44 : 32,
          )
          expect(Math.abs(button.center - box.center)).toBeLessThan(1)
        }
      }
      const own = boxes.filter((box) => box.buttons.length > 0)
      expect(own).toHaveLength(2)
      for (const box of own)
        expect(
          box.buttons[1].offset - box.buttons[0].offset - box.buttons[0].width,
        ).toBe(0)
      expect(own[0].buttons.map((button) => button.offset)).toEqual(
        own[1].buttons.map((button) => button.offset),
      )
      expect(boxes.filter((box) => box.buttons.length === 0)).toHaveLength(7)
      const readonlyWidth = (label: string) =>
        boxes.find((box) => !box.buttons.length && box.value === label)!.width
      expect(readonlyWidth('9.00 kg')).toBeLessThan(readonlyWidth('99.95 kg'))
      expect(readonlyWidth('99.95 kg')).toBeLessThan(readonlyWidth('105.25 kg'))
      expect(readonlyWidth('105.25 kg')).toBeLessThan(
        readonlyWidth('1000.50 kg'),
      )
      const scroll = page.getByRole('region', {
        name: 'Scrollable shared group weights',
      })
      await scroll.scrollIntoViewIfNeeded()
      await scroll.screenshot({
        path: test.info().outputPath('fixed-weight-cards.png'),
      })
      if (layout.width >= 500)
        await scroll.evaluate((element) => {
          element.style.maxWidth = '700px'
        })
      expect(
        await scroll.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      ).toBe(true)
      await scroll.evaluate((element) => {
        element.scrollLeft = 180
      })
      await expect
        .poll(() => scroll.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0)
      const date = matrix.getByRole('rowheader', { name: '2026-09-22' })
      const firstCard = date.locator('xpath=../td[1]/div')
      const dateBox = (await date.boundingBox())!
      const scrolledCardBox = (await firstCard.boundingBox())!
      expect(scrolledCardBox.x).toBeLessThan(dateBox.x + dateBox.width)
      expect(scrolledCardBox.x + scrolledCardBox.width).toBeGreaterThan(
        dateBox.x,
      )
      expect(
        await date.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return [box.x + 8, box.x + box.width / 2, box.right - 8].every(
            (x) =>
              document
                .elementFromPoint(x, box.y + box.height / 2)
                ?.closest('th') === element,
          )
        }),
      ).toBe(true)
      expect(
        await date.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ).toBe('rgb(17, 28, 40)')
      expect(
        await date.evaluate((element) => getComputedStyle(element).color),
      ).toBe('rgb(241, 246, 250)')
      const corner = matrix.getByRole('columnheader', { name: 'Recorded date' })
      expect(
        await corner.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return (
            document
              .elementFromPoint(box.right - 8, box.y + box.height / 2)
              ?.closest('th') === element
          )
        }),
      ).toBe(true)
      await scroll.screenshot({
        path: test.info().outputPath('compact-scrolled-matrix.png'),
      })
    } finally {
      await context.close()
    }
  })
}

test('selected Group sections retain readable contrast in both color schemes', async ({
  page,
}) => {
  await installGroupFixtures(page, true)
  await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    for (const [section, selector] of [
      ['Overview', '.group-overview-metric dd'],
      ['Weekly results', '.group-overview-leader li span'],
      ['Charts', '.group-member-tab-active'],
    ]) {
      await page
        .getByRole('navigation', { name: 'Group sections' })
        .getByRole('link', { name: section, exact: true })
        .click()
      const target = page.locator(selector).first()
      await expect(target).toBeVisible()
      const ratio = await target.evaluate((element) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        const luminance = (color: string) => {
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map(
            (channel) => {
              const value = channel / 255
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4
            },
          )
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        let background = element as Element | null
        while (
          background &&
          getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)'
        )
          background = background.parentElement
        const values = [
          luminance(getComputedStyle(element).color),
          luminance(getComputedStyle(background!).backgroundColor),
        ].sort((a, b) => b - a)
        return (values[0] + 0.05) / (values[1] + 0.05)
      })
      expect(ratio, `${colorScheme} ${section}`).toBeGreaterThanOrEqual(4.5)
    }
  }
})

for (const width of [320, 390, 430, 1280]) {
  test(`Group overview summary row geometry at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await expect(
      page.getByRole('heading', { name: 'Group progress', exact: true }),
    ).toBeVisible()
    const metrics = page.locator('.group-overview-metric')
    await expect(metrics).toHaveCount(4)
    const chart = page
      .locator('.group-history-workspace svg[role="img"]')
      .first()
    await expect(chart).toBeVisible()
    const bounds = await page.evaluate(() => {
      const rect = (element: Element) => {
        const { x, y, width, height, right, bottom } =
          element.getBoundingClientRect()
        return { x, y, width, height, right, bottom }
      }
      const card = document.querySelector('#group-summary')!
      const row = card.querySelector('dl')!
      const chart = document.querySelector(
        '.group-history-workspace svg[role="img"]',
      )!
      return {
        card: rect(card),
        row: rect(row),
        metrics: Array.from(row.children, rect),
        metricText: Array.from(row.children, (metric) => {
          const label = metric.querySelector('dt')!
          const value = metric.querySelector('dd')!
          const rangeRect = (element: Element) => {
            const range = document.createRange()
            range.selectNodeContents(element)
            const { x, y, width, height, right, bottom } =
              range.getBoundingClientRect()
            return { x, y, width, height, right, bottom }
          }
          return { label: rangeRect(label), value: rangeRect(value) }
        }),
        chart: rect(chart),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }
    })
    console.log('group-overview-summary-bounds', width, bounds)
    await expect(metrics.nth(0)).toContainText('Members')
    await expect(metrics.nth(0)).toContainText('3')
    await expect(metrics.nth(1)).toContainText('42.5%')
    await expect(metrics.nth(2)).toContainText('Checked in')
    await expect(metrics.nth(3)).toContainText('Goals reached')
    if (width < 640) {
      const row = bounds.row
      for (const metric of bounds.metrics) {
        expect(metric.x).toBeGreaterThanOrEqual(row.x)
        expect(metric.right).toBeLessThanOrEqual(row.right)
      }
      for (const text of bounds.metricText) {
        for (const box of [text.label, text.value]) {
          expect(box.x).toBeGreaterThanOrEqual(row.x)
          expect(box.right).toBeLessThanOrEqual(row.right)
        }
      }
      if (width >= 390) {
        expect(new Set(bounds.metrics.map((metric) => metric.y)).size).toBe(1)
        expect(bounds.row.height).toBeLessThanOrEqual(60)
        expect(bounds.chart.y).toBeLessThan(530)
      } else {
        expect(new Set(bounds.metrics.map((metric) => metric.y)).size).toBe(2)
        expect(bounds.chart.y).toBeLessThan(665)
      }
    } else {
      expect(bounds.card.height).toBeCloseTo(103.15625, 1)
      expect(bounds.row.height).toBeCloseTo(67.1875, 1)
      expect(bounds.chart.x).toBeCloseTo(37, 1)
      expect(bounds.chart.y).toBeCloseTo(444.15625, 1)
      expect(bounds.chart.width).toBeCloseTo(1206, 1)
      expect(bounds.chart.height).toBeCloseTo(441.140625, 1)
    }
    await page.screenshot({
      path: testInfo.outputPath(`group-overview-${width}-after.png`),
    })
    if (width < 640) {
      await page.locator('#group-summary').evaluate((card) => {
        ;(card as HTMLElement).style.fontSize = '20px'
      })
      await metrics
        .nth(1)
        .locator('dt')
        .evaluate((label) => {
          label.textContent = 'Durchschnitt der Gruppenziele'
        })
      await metrics.locator('dt, dd').evaluateAll((texts) => {
        for (const text of texts) {
          ;(text as HTMLElement).style.fontSize = '20px'
          ;(text as HTMLElement).style.lineHeight = '1.2'
        }
      })
      const enlarged = await metrics.evaluateAll((cards) =>
        cards.map((card) => {
          const cardBox = card.getBoundingClientRect()
          const textBoxes = ['dt', 'dd'].flatMap((selector) => {
            const range = document.createRange()
            range.selectNodeContents(card.querySelector(selector)!)
            return Array.from(range.getClientRects(), (rect) => ({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              cardLeft: cardBox.left,
              cardRight: cardBox.right,
              cardTop: cardBox.top,
              cardBottom: cardBox.bottom,
            }))
          })
          return { textBoxes }
        }),
      )
      for (const { textBoxes } of enlarged) {
        for (const textBox of textBoxes) {
          expect(textBox.left).toBeGreaterThanOrEqual(textBox.cardLeft)
          expect(textBox.right).toBeLessThanOrEqual(textBox.cardRight)
          expect(textBox.top).toBeGreaterThanOrEqual(textBox.cardTop)
          expect(textBox.bottom).toBeLessThanOrEqual(textBox.cardBottom)
        }
      }
      await expect(metrics.nth(1)).toContainText('42.5%')
      const enlargedRows = await metrics.evaluateAll(
        (cards) =>
          new Set(cards.map((card) => card.getBoundingClientRect().top)).size,
      )
      expect(enlargedRows).toBe(2)
      const pageWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(pageWidth).toBeLessThanOrEqual(width === 320 ? 323 : width)
      await page.screenshot({
        path: testInfo.outputPath(`group-overview-${width}-large-text.png`),
      })
    }
  })
}

for (const width of [1280, 390]) {
  test(`Group top actions align and retain disclosure/refresh behavior at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const requests = await installGroupFixtures(page, true, true)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    const actions = page.getByRole('group', {
      name: 'Group actions',
      exact: true,
    })
    const record = actions.getByRole('button', {
      name: 'Record weight',
      exact: true,
    })
    const create = actions.getByRole('button', {
      name: 'Create or join a group',
      exact: true,
    })
    const refresh = actions.getByRole('button', {
      name: 'Refresh shared progress',
      exact: true,
    })
    for (const name of [
      'Record weight',
      'Create or join a group',
      'Refresh shared progress',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        1,
      )
    }
    await expect(record).toBeEnabled()
    const boxes = await Promise.all(
      [record, create, refresh].map((button) => button.boundingBox()),
    )
    for (const box of boxes) {
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    }
    if (width === 1280) {
      expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2)
      expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThan(2)
    } else {
      expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y)
      expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y)
    }
    await create.focus()
    const historyBefore = await page
      .getByRole('heading', { name: 'Group progress', exact: true })
      .boundingBox()
    await page.keyboard.press('Enter')
    await expect(create).toHaveAttribute('aria-expanded', 'true')
    const panel = page.getByRole('dialog', {
      name: 'Create or join a group',
      exact: true,
    })
    await expect(
      panel.getByRole('link', { name: 'Create challenge', exact: true }),
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Join with invitation', exact: true }),
    ).toBeVisible()
    const panelBox = (await panel.boundingBox())!
    expect(panelBox.x).toBeGreaterThanOrEqual(16)
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(width - 16)
    expect(panelBox.y).toBeCloseTo(boxes[1]!.y + boxes[1]!.height + 8, 0)
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(900 - 16)
    const historyAfter = await page
      .getByRole('heading', { name: 'Group progress', exact: true })
      .boundingBox()
    expect(historyAfter!.y).toBeCloseTo(historyBefore!.y, 0)
    await expect(
      panel.getByRole('button', { name: 'Close create/join' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      panel.getByRole('link', { name: 'Create challenge', exact: true }),
    ).toBeFocused()
    await panel
      .getByRole('button', { name: 'Join with invitation', exact: true })
      .click()
    await panel.getByLabel('Invitation link or token').fill('draft-invitation')
    await page.screenshot({
      path: test.info().outputPath(`group-popover-${width}.png`),
      fullPage: false,
    })
    await page.setViewportSize({ width: 320, height: 568 })
    await expect
      .poll(async () => {
        const box = await panel.boundingBox()
        return Boolean(
          box &&
          box.x >= 16 &&
          box.y >= 16 &&
          box.x + box.width <= 304 &&
          box.y + box.height <= 552,
        )
      })
      .toBe(true)
    await expect(panel.getByLabel('Invitation link or token')).toHaveValue(
      'draft-invitation',
    )
    await page.setViewportSize({ width, height: 900 })
    await page.keyboard.press('Escape')
    await expect(create).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toHaveCount(0)
    await expect(create).toBeFocused()
    await create.click()
    await expect(panel.getByLabel('Invitation link or token')).toHaveValue(
      'draft-invitation',
    )
    await page
      .locator('.app-shell-header-inner')
      .click({ position: { x: 1, y: 1 } })
    await expect(panel).toHaveCount(0)
    await create.click()
    await expect(panel.getByLabel('Invitation link or token')).toHaveValue(
      'draft-invitation',
    )
    await panel
      .getByRole('link', { name: 'Create challenge', exact: true })
      .click()
    const discard = page.getByRole('dialog', { name: 'Discard unsaved input?' })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Stay', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Group progress', exact: true }),
    ).toBeVisible()
    if (!(await panel.isVisible())) await create.click()
    await expect(panel.getByLabel('Invitation link or token')).toHaveValue(
      'draft-invitation',
    )
    await panel.getByRole('button', { name: 'Close create/join' }).click()
    await expect(create).toBeFocused()
    const before = requests.filter((url) =>
      url.includes('/rpc/get_group_progress_summary'),
    ).length
    await refresh.click()
    await expect
      .poll(
        () =>
          requests.filter((url) =>
            url.includes('/rpc/get_group_progress_summary'),
          ).length,
      )
      .toBeGreaterThan(before)
    await expect(refresh).toBeFocused()
    await expect(
      page.getByRole('heading', { name: 'Group progress', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`group-top-actions-${width}.png`),
      fullPage: true,
    })
  })

  test(`contextual Group restores legacy sections and keeps each destination distinct at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await installGroupFixtures(page, true, true)
    for (const suffix of [
      '',
      '&tab=overview',
      '&tab=progress',
      '#group-history',
    ]) {
      await page.goto(
        `/e2e/fixtures/today-harness.html?${new URLSearchParams({ scenario: 'group', user: viewerId, route: `/group?challenge=${ownGroupId}${suffix}` })}`,
      )
      await page.reload()
      const sections = page.getByRole('navigation', { name: 'Group sections' })
      const charts = suffix === '&tab=progress' || suffix === '#group-history'
      await expect(
        sections.getByRole('link', {
          name: charts ? 'Charts' : 'Overview',
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page')
      await expect(
        page.getByRole('table', { name: 'Shared group weight history' }),
      ).toHaveCount(charts ? 1 : 0)
      await expect(
        page.getByRole('heading', { name: 'Weekly result', exact: true }),
      ).toHaveCount(0)
      const members = sections.getByRole('link', {
        name: 'Members',
        exact: true,
      })
      await members.focus()
      await page.keyboard.press('Enter')
      await expect(
        page.getByRole('heading', { name: 'Member progress', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('table', { name: 'Shared group weight history' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'Change target', exact: true }),
      ).toHaveCount(1)
      await sections.getByRole('link', { name: 'Weekly results' }).click()
      await expect(
        page.getByRole('heading', { name: 'Weekly result', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Member progress', exact: true }),
      ).toHaveCount(0)
      await sections.getByRole('link', { name: 'Charts' }).click()
      await expect(
        page.getByRole('tab', { name: 'All members', exact: true }),
      ).toHaveAttribute('aria-selected', 'true')
      await expect(
        sections.getByRole('link', { name: 'Members' }),
      ).toHaveAttribute(
        'href',
        new RegExp(`challenge=${ownGroupId}.*tab=members`),
      )
      await expect(
        page.getByText('Other member private note must never render'),
      ).toHaveCount(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    }
    await page.screenshot({
      path: test.info().outputPath(`contextual-group-${width}.png`),
      fullPage: true,
    })
  })
}

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`Weigh-ins keeps author controls and links Group history on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await installGroupFixtures(page, true, true)
    await page.goto(
      `http://127.0.0.1:4174/e2e/fixtures/today-harness.html?scenario=progress&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    const personal = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    const edit = personal.getByRole('button', {
      name: 'Edit weight 2026-09-22',
      exact: true,
    })
    const remove = personal.getByRole('button', {
      name: 'Delete 2026-09-22',
      exact: true,
    })
    await expect(edit).toBeVisible()
    await expect(personal.locator('li')).toHaveCount(1)
    await expect(
      page.getByRole('table', { name: 'Shared group weigh-ins' }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Other member private note must never render'),
    ).toHaveCount(0)
    await expect(personal).toContainText('Author-only disposable private note')
    await edit.click()
    const editor = page.getByRole('form', { name: 'Personal weigh-in form' })
    await expect(editor.getByLabel('Private note')).toHaveValue(
      'Author-only disposable private note',
    )
    await editor.getByLabel('Weight in kg').fill('87')
    await editor.getByRole('button', { name: 'Update weight' }).click()
    await expect(personal).toContainText('87 kg')
    await expect(edit).toBeVisible()
    await expect(personal).toContainText('87 kg')
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(page.getByText(/No personal goal yet/)).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Open this group’s shared history/ }),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Dashboard sections' })
      .getByRole('link', { name: 'Weigh-ins', exact: true })
      .click()
    await remove.click()
    const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
    await expect(deletion).toContainText('ALL shared groups')
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(remove).toBeFocused()
    await remove.click()
    await deletion
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(personal).toHaveCount(0)
    await expect(
      page.getByRole('list', { name: 'Your own personal entry actions' }),
    ).toHaveCount(0)
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Group', exact: true })
      .click()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    await expect(
      page.getByRole('table', { name: 'Shared group weight history' }),
    ).toBeVisible()
    await expect(
      page.getByText('Other member private note must never render'),
    ).toHaveCount(0)
  })
  test(`only own matrix cards edit/delete and refresh selected groups on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 700 })
    const requests = await installGroupFixtures(page, true, true)
    await page.goto(
      `/e2e/fixtures/today-harness.html?scenario=group&selected=${ownGroupId}&user=${viewerId}`,
    )
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const matrix = page.getByRole('table', {
      name: 'Shared group weight history',
    })
    const ownOrdinal =
      memberKey(ownGroupId, viewerId) < memberKey(ownGroupId, otherViewerId)
        ? 1
        : 2
    const ownName = `Ava (member ${ownOrdinal})`
    const otherName = `Ava (member ${3 - ownOrdinal})`
    const edit = matrix.getByRole('button', {
      name: `Edit weight 2026-09-22 for ${ownName}`,
      exact: true,
    })
    const remove = matrix.getByRole('button', {
      name: `Delete 2026-09-22 for ${ownName}`,
      exact: true,
    })
    await expect(edit).toBeVisible()
    await expect(matrix.getByRole('button')).toHaveCount(2)
    await expect(matrix.getByText('88.50 kg', { exact: true })).toHaveCount(2)
    const ownReadonly = matrix
      .getByText('90.00 kg', { exact: true })
      .locator('xpath=..')
    await expect(ownReadonly.getByRole('button')).toHaveCount(0)
    expect((await ownReadonly.boundingBox())!.width).toBeLessThan(80)
    const card = edit.locator('xpath=../..')
    const value = card.getByText('88.50 kg', { exact: true })
    const valueBox = (await value.boundingBox())!
    const editBox = (await edit.boundingBox())!
    const deleteBox = (await remove.boundingBox())!
    const cardBox = (await card.boundingBox())!
    expect(editBox.x).toBeGreaterThanOrEqual(valueBox.x + valueBox.width)
    expect(deleteBox.x).toBeGreaterThanOrEqual(editBox.x + editBox.width)
    expect(
      Math.abs(
        valueBox.y + valueBox.height / 2 - editBox.y - editBox.height / 2,
      ),
    ).toBeLessThan(1)
    expect(
      Math.abs(
        editBox.y + editBox.height / 2 - deleteBox.y - deleteBox.height / 2,
      ),
    ).toBeLessThan(1)
    expect(cardBox.height).toBeLessThanOrEqual(50)
    expect(editBox.width).toBeGreaterThanOrEqual(32)
    expect(deleteBox.width).toBeGreaterThanOrEqual(32)
    await edit.focus()
    await page.keyboard.press('Tab')
    await expect(remove).toBeFocused()
    await expect(
      page.getByRole('list', { name: 'Your own shared group entries' }),
    ).toHaveCount(0)
    await page.getByRole('tab', { name: ownName, exact: true }).click()
    await expect(edit).toBeVisible()
    await expect(matrix.getByRole('button')).toHaveCount(2)
    await page.getByRole('tab', { name: otherName, exact: true }).click()
    await expect(matrix.getByRole('button')).toHaveCount(0)
    await expect(matrix.getByText('88.50 kg', { exact: true })).toBeVisible()
    await page.keyboard.press('Home')
    await expect(edit).toBeVisible()
    await edit.click()
    const editor = page.getByRole('dialog', {
      name: 'Edit weight',
      exact: true,
    })
    if (viewport.width > 600)
      await expect(editor.getByLabel('Weight in kg')).toBeFocused()
    else {
      await expect(editor).toBeFocused()
      await editor.getByRole('button', { name: /Private note/ }).click()
    }
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('88.5')
    await expect(editor.getByLabel('Private note (optional)')).toHaveValue(
      'Author-only disposable private note',
    )
    await expect(editor.getByRole('checkbox')).toHaveCount(2)
    await expect(editor.getByRole('checkbox').first()).toBeChecked()
    await expect(editor.getByRole('checkbox').last()).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(edit).toBeFocused()
    await edit.click()
    await editor.getByLabel('Weight in kg').fill('87')
    await editor.getByRole('button', { name: 'Update weight' }).click()
    await expect(matrix.getByText('87.00 kg', { exact: true })).toBeVisible()
    await expect(matrix.getByText('88.50 kg', { exact: true })).toBeVisible()
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
      .getByRole('navigation', { name: 'Challenge contexts' })
      .getByRole('link', {
        name: 'Group · Second authorized group',
        exact: true,
      })
      .click()
    await expect(matrix.getByText('87.00 kg', { exact: true })).toBeVisible()
    await expect(matrix.getByRole('button')).toHaveCount(2)
    await matrix
      .getByRole('button', { name: /^Edit weight 2026-09-22 for Jo/ })
      .click()
    await expect(editor.getByLabel('Weight in kg')).toHaveValue('87')
    await page.keyboard.press('Escape')
    await page
      .getByRole('navigation', { name: 'Challenge contexts' })
      .getByRole('link', { name: 'Group · E2E authorized group', exact: true })
      .click()
    await remove.click()
    const deletion = page.getByRole('dialog', { name: 'Delete weight?' })
    await expect(deletion).toContainText('87 kg recorded 2026-09-22')
    await expect(deletion).toContainText('ALL shared groups')
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(remove).toBeFocused()
    await expect(matrix.getByText('87.00 kg', { exact: true })).toBeVisible()
    await remove.click()
    await deletion
      .getByRole('button', { name: 'Delete weight', exact: true })
      .click()
    await expect(matrix.getByRole('button')).toHaveCount(0)
    await expect(matrix.getByText('87.00 kg', { exact: true })).toHaveCount(0)
    await expect(matrix.getByText('88.50 kg', { exact: true })).toBeVisible()
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
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Overview', exact: true })
      .click()
    await expect(page.getByText('73.2%', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    await expect(matrix.getByRole('button')).toHaveCount(0)
    await expect(matrix.getByText('87.00 kg', { exact: true })).toHaveCount(0)
    await expect(matrix.getByText('88.50 kg', { exact: true })).toBeVisible()
  })
  test(`spreadsheet member tabs and sticky navigation stay usable on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: viewport.width })
    await page.emulateMedia({ colorScheme: 'dark' })
    const requests = await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    await expect(
      page.getByRole('navigation', { name: 'Group sections' }),
    ).toHaveCount(1)
    await expect(
      page.getByRole('heading', { name: 'Weekly result', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Member progress', exact: true }),
    ).toHaveCount(0)
    const table = page.getByRole('table', {
      name: 'Shared group weight history',
    })
    const chart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
    await expect(chart).toBeVisible()
    await expect(chart.locator('.chart-axis-tick').first()).toHaveCSS(
      'font-size',
      '10.2px',
    )
    await expect(chart.locator('.chart-axis-title')).toHaveCSS(
      'font-size',
      '12px',
    )
    await expect(chart).toHaveAttribute(
      'data-chart-plot-left',
      viewport.width <= 600 ? '32' : '44',
    )
    await expect(chart).toHaveAttribute(
      'data-chart-plot-right',
      viewport.width <= 600 ? '304' : '736',
    )
    await expect(chart).toHaveAttribute('data-chart-plot-top', '27')
    const firstChartPoint = chart
      .locator('circle[data-point-kind="recorded"][data-chart-point]')
      .first()
    await firstChartPoint.hover()
    const pointTooltip = page.getByRole('tooltip')
    await expect(pointTooltip).toContainText(
      /Ava \(member 1\).*20\.09\.2026.*90 kg/,
    )
    await page.mouse.move(8, 8)
    await expect(pointTooltip).toHaveCount(0)
    const groupLegend = page.getByRole('list', {
      name: 'Group chart legend',
    })
    await expect(groupLegend.locator('li')).toHaveText([
      'Ava (member 1)',
      'Ava (member 2)',
    ])
    const chartRegion = page.getByRole('region', {
      name: 'Group comparison chart',
    })
    const expectChartFrameInsideCard = async (targetChart: typeof chart) => {
      const [sectionBounds, frameBounds] = await Promise.all([
        targetChart.locator('xpath=ancestor::section[1]').boundingBox(),
        targetChart.locator('xpath=../..').boundingBox(),
      ])
      expect(sectionBounds).not.toBeNull()
      expect(frameBounds).not.toBeNull()
      expect(frameBounds!.x).toBeGreaterThanOrEqual(sectionBounds!.x)
      expect(frameBounds!.x + frameBounds!.width).toBeLessThanOrEqual(
        sectionBounds!.x + sectionBounds!.width,
      )
    }
    await expectChartFrameInsideCard(chart)
    const expectLegendCentered = async () => {
      const [legendBox, chartRegionBox] = await Promise.all([
        groupLegend.boundingBox(),
        chartRegion.boundingBox(),
      ])
      expect(legendBox).not.toBeNull()
      expect(chartRegionBox).not.toBeNull()
      expect(
        Math.abs(
          legendBox!.x +
            legendBox!.width / 2 -
            chartRegionBox!.x -
            chartRegionBox!.width / 2,
        ),
      ).toBeLessThanOrEqual(1)
    }
    await expectLegendCentered()
    const originalPoints = await chart
      .locator('circle[data-point-kind="recorded"]')
      .evaluateAll((elements) =>
        elements.map((circle) => ({
          label: circle.textContent,
          y: Number(circle.getAttribute('cy')),
        })),
      )
    const heavier = originalPoints.find(
      (point) => point.label === 'Ava (member 1): 20.09.2026, 90 kg',
    )!
    const lighter = originalPoints.find(
      (point) => point.label === 'Ava (member 2): 20.09.2026, 70 kg',
    )!
    const plotBottom = await chart.evaluate(
      (element) =>
        Number(element.getAttribute('viewBox')?.trim().split(/\s+/)[3]) - 36,
    )
    expect(heavier.y).toBeLessThan(lighter.y)
    for (const point of originalPoints) {
      expect(point.y).toBeGreaterThan(27)
      expect(point.y).toBeLessThanOrEqual(plotBottom)
    }
    await expect(chart).toContainText('Weight (kg)')
    await chart.screenshot({
      path: test.info().outputPath('actual-kg-chart.png'),
    })
    const rangeControls = page.getByRole('group', {
      name: 'Chart date range controls',
    })
    const chartControlsTrack = page.getByRole('group', {
      name: 'Adjust visible date range',
    })
    await expect(chartControlsTrack.getByRole('slider')).toHaveCount(2)
    const quickRangeLabel = await rangeControls
      .getByText('Date range', { exact: true })
      .boundingBox()
    const chartBounds = await chart.boundingBox()
    expect(quickRangeLabel).not.toBeNull()
    expect(chartBounds).not.toBeNull()
    if (viewport.width <= 600) {
      expect(
        Math.abs(
          quickRangeLabel!.x +
            quickRangeLabel!.width / 2 -
            chartBounds!.x -
            chartBounds!.width / 2,
        ),
      ).toBeLessThan(2)
      await expect(rangeControls.getByRole('button')).toHaveCount(5)
      await expect(chartControlsTrack.getByRole('slider')).toHaveCount(2)
      for (const control of await rangeControls.getByRole('button').all()) {
        await expect(control).toBeVisible()
        const controlBounds = (await control.boundingBox())!
        expect(controlBounds.height).toBeGreaterThanOrEqual(44)
      }
      const regionBounds = await chartRegion.boundingBox()
      expect(regionBounds).not.toBeNull()
      await expectChartFrameInsideCard(chart)
    } else {
      expect(
        Math.abs(
          quickRangeLabel!.x -
            (chartBounds!.x + (44 / 760) * chartBounds!.width),
        ),
      ).toBeLessThan(2)
    }
    const initialChartPoints = await chart
      .locator('circle[data-point-kind="recorded"][data-date]')
      .count()
    const groupStartSlider = chartControlsTrack.getByRole('slider', {
      name: 'Visible range start',
    })
    const initialStartDate =
      await groupStartSlider.getAttribute('aria-valuetext')
    await groupStartSlider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(groupStartSlider).not.toHaveAttribute(
      'aria-valuetext',
      initialStartDate!,
    )
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(2)
    await rangeControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(initialChartPoints)
    const allMembersEnd = chartControlsTrack.getByRole('slider', {
      name: 'Visible range end',
    })
    const originalAllMembersEnd =
      await allMembersEnd.getAttribute('aria-valuetext')
    await allMembersEnd.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(allMembersEnd).not.toHaveAttribute(
      'aria-valuetext',
      originalAllMembersEnd!,
    )
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(3)
    await rangeControls.getByRole('button', { name: 'Show all dates' }).click()
    await expect(
      chart.locator('circle[data-point-kind="recorded"][data-date]'),
    ).toHaveCount(initialChartPoints)
    await expect(table.getByRole('columnheader')).toHaveText([
      'Date',
      'Ava (member 1) (kg)',
      'Ava (member 2) (kg)',
    ])
    const missing = table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: '2026-09-21' }) })
    await expect(missing.getByRole('cell')).toHaveText([
      '—',
      '71.00 kg; change from first shared entry +1 kg Previous shared entry: +1 kg',
    ])
    const tabs = page.getByRole('tablist', { name: 'Shared group members' })
    const all = tabs.getByRole('tab', { name: 'All members' })
    await all.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      tabs.getByRole('tab', { name: 'Ava (member 1)' }),
    ).toBeFocused()
    await expect(table.getByRole('columnheader')).toHaveCount(2)
    await expect(table).toContainText('88.50 kg')
    await expect(table).not.toContainText('70.00 kg')
    await expect(
      page.getByRole('img').locator('circle[data-point-kind="recorded"]'),
    ).toHaveCount(2)
    await page.keyboard.press('End')
    await expect(
      tabs.getByRole('tab', { name: 'Ava (member 2)' }),
    ).toBeFocused()
    await expect(table).toContainText('71.00 kg')
    await expect(table).not.toContainText('88.50 kg')
    await page.keyboard.press('Home')
    await expect(all).toBeFocused()
    await tabs.getByRole('tab', { name: 'Ava (member 2)' }).click()
    const individualChart = page.getByRole('img', {
      name: 'Weight (kg) — shared group history',
    })
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
    await expect(groupLegend.locator('li')).toHaveText(['Ava (member 2)'])
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
    expect(
      await navigation.evaluate((element) =>
        element.nextElementSibling?.getAttribute('role'),
      ),
    ).toBe('tabpanel')
    await navigation.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    )
    const navigationPosition = await navigation.evaluate((element) => ({
      top: Math.round(element.getBoundingClientRect().top),
      atDocumentEnd:
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 1,
    }))
    expect(navigationPosition.top).toBeLessThanOrEqual(
      navigationPosition.atDocumentEnd ? 12 : 1,
    )
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
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
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
    await installGroupFixtures(page, true)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
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
      .getByRole('link', { name: 'Charts', exact: true })
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
    const requests = await installGroupFixtures(page)
    await page.goto('/e2e/fixtures/today-harness.html?scenario=group')

    await expect(
      page.getByRole('heading', { name: 'E2E authorized group', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('42.5%', { exact: true })).toBeVisible()
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

    await page
      .getByRole('navigation', { name: 'Group sections' })
      .getByRole('link', { name: 'Charts', exact: true })
      .click()
    const historyPanel = page.getByRole('region', {
      name: 'Group chart and weigh-in history',
    })
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
    const chart = historyPanel.getByRole('img')
    await expect(chart).toHaveCount(1)
    await expect(historyPanel.getByRole('table')).toHaveCount(1)
    const quickRanges = historyPanel.getByRole('group', {
      name: 'Quick date ranges',
    })
    await expect(quickRanges.getByRole('button')).toHaveCount(5)
    const oneWeek = quickRanges.getByRole('button', {
      name: 'Show last 1 week',
    })
    await oneWeek.click()
    await expect(oneWeek).toHaveAttribute('aria-pressed', 'true')
    await expect(
      historyPanel.getByRole('status', { name: 'Visible date range' }),
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
    await expect(historyPanel.getByRole('button')).toHaveCount(
      5 + chartPointCount,
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
    await page.touchscreen.tap(5, 5)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
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

    await ownRecorded.focus()
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
  const [selectorBackground, memberTabsBackground] = await Promise.all([
    selector.evaluate((element) => getComputedStyle(element).backgroundColor),
    memberTabs.evaluate((element) => getComputedStyle(element).backgroundColor),
  ])
  expect(selectorBackground).toBe(memberTabsBackground)
})

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
  expect(badgeMetrics.fontSize).toBe('12px')
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

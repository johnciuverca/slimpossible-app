import { expect, test, type Page } from '@playwright/test'

const fixture = '/e2e/fixtures/personal-weigh-in-harness.html'

async function unusedPastDate(page: Page) {
  const today = await page
    .getByLabel('Date', { exact: true })
    .getAttribute('max')
  expect(today).toBeTruthy()
  const past = new Date(`${today}T00:00:00.000Z`)
  past.setUTCDate(past.getUTCDate() - 2)
  return past.toISOString().slice(0, 10)
}

async function canonicalRows(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem('slimpossible.local.personal-weigh-ins') ?? '[]',
      ) as {
        id: string
        userId: string
        date: string
        weightKg: number
        note?: string
        sharedChallengeIds: string[]
      }[],
  )
}

for (const viewport of [
  { label: 'desktop', width: 1280 },
  { label: 'mobile', width: 390 },
]) {
  test(`canonical zero-context private past-date save, keyboard correction and refresh on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(`${fixture}?scenario=zero-context`)
    const form = page.getByRole('form', { name: 'Personal weigh-in form' })
    await expect(form).toBeVisible()
    await expect(page.getByText('Local storage', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    expect(
      await page.evaluate(() => ({
        challenges: JSON.parse(
          localStorage.getItem('slimpossible.local.challenges') ?? '[]',
        ),
        memberships: JSON.parse(
          localStorage.getItem('slimpossible.local.participants') ?? '[]',
        ),
      })),
    ).toEqual({ challenges: [], memberships: [] })
    expect(await canonicalRows(page)).toEqual([])

    const pastDate = await unusedPastDate(page)
    await page.getByLabel('Date', { exact: true }).fill(pastDate)
    await page.getByLabel('Weight in kg').fill('82.4')
    const note = page.getByLabel('Private note (optional)')
    await note.fill('Synthetic author-private late entry.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Save weigh-in', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    await expect(history.getByRole('listitem')).toHaveCount(1)
    await expect(
      history.getByText(`${pastDate}: 82.4 kg`, { exact: true }),
    ).toBeVisible()
    await expect(
      history.getByText('Synthetic author-private late entry.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      history.getByText('Private — not shared with a group'),
    ).toBeVisible()
    const [original] = await canonicalRows(page)
    expect(original).toMatchObject({
      date: pastDate,
      weightKg: 82.4,
      sharedChallengeIds: [],
    })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)

    await page.reload()
    await expect(
      history.getByText(`${pastDate}: 82.4 kg`, { exact: true }),
    ).toBeVisible()
    await expect(
      history.getByText('Synthetic author-private late entry.', {
        exact: true,
      }),
    ).toBeVisible()
    // Same-date save corrects the same canonical row, rather than inserting another.
    await page.getByLabel('Date', { exact: true }).fill(pastDate)
    await page.getByLabel('Weight in kg').fill('82.1')
    await note.fill('Synthetic same-date correction.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Save weigh-in', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      history.getByText(`${pastDate}: 82.1 kg`, { exact: true }),
    ).toBeVisible()
    expect(await canonicalRows(page)).toEqual([
      expect.objectContaining({
        id: original.id,
        date: pastDate,
        weightKg: 82.1,
        sharedChallengeIds: [],
      }),
    ])

    await page
      .getByRole('button', { name: `Edit ${pastDate}`, exact: true })
      .click()
    await page.getByLabel('Weight in kg').fill('81.9')
    await note.fill('Synthetic edited private note.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Update weigh-in', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      history.getByText(`${pastDate}: 81.9 kg`, { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(history.getByRole('listitem')).toHaveCount(1)
    await expect(
      history.getByText('Synthetic edited private note.', { exact: true }),
    ).toBeVisible()
    expect(await canonicalRows(page)).toEqual([
      expect.objectContaining({
        id: original.id,
        weightKg: 81.9,
        sharedChallengeIds: [],
      }),
    ])
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
  })

  test(`canonical same-date and edit corrections preserve explicit draft/active shares on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto(`${fixture}?scenario=groups`)
    const draft = page.getByRole('checkbox', {
      name: 'Synthetic draft group',
      exact: true,
    })
    const active = page.getByRole('checkbox', {
      name: 'Synthetic active group',
      exact: true,
    })
    await expect(draft).not.toBeChecked()
    await expect(active).not.toBeChecked()
    const pastDate = await unusedPastDate(page)
    await page.getByLabel('Date', { exact: true }).fill(pastDate)
    await page.getByLabel('Weight in kg').fill('90')
    const note = page.getByLabel('Private note (optional)')
    await note.fill('Synthetic note never included in group sharing.')
    await note.focus()
    await page.keyboard.press('Tab')
    await expect(draft).toBeFocused()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await expect(active).toBeFocused()
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Save weigh-in', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    const history = page.getByRole('list', {
      name: 'Personal weigh-in history',
    })
    await expect(
      history.getByText(`${pastDate}: 90 kg`, { exact: true }),
    ).toBeVisible()
    const [original] = await canonicalRows(page)
    const expectedShares = ['canonical-draft-group', 'canonical-active-group']
    expect(original.sharedChallengeIds).toEqual(expectedShares)

    // A fresh entry starts private again; shares are selected explicitly for this correction.
    await expect(draft).not.toBeChecked()
    await expect(active).not.toBeChecked()
    await page.getByLabel('Date', { exact: true }).fill(pastDate)
    await page.getByLabel('Weight in kg').fill('89.9')
    await note.fill('Synthetic same-date shared correction.')
    await draft.check()
    await active.check()
    await page
      .getByRole('button', { name: 'Save weigh-in', exact: true })
      .click()
    await expect(
      history.getByText(`${pastDate}: 89.9 kg`, { exact: true }),
    ).toBeVisible()
    expect(await canonicalRows(page)).toEqual([
      expect.objectContaining({
        id: original.id,
        weightKg: 89.9,
        sharedChallengeIds: expectedShares,
      }),
    ])
    await page.reload()
    await page
      .getByRole('button', { name: `Edit ${pastDate}`, exact: true })
      .click()
    await expect(draft).toBeChecked()
    await expect(active).toBeChecked()
    await expect(page.getByText(/Saving will remove/)).toHaveCount(0)
    await page.getByLabel('Weight in kg').fill('89.8')
    await note.fill('Synthetic shared edit.')
    await page
      .getByRole('button', { name: 'Update weigh-in', exact: true })
      .click()
    await expect(
      history.getByText(`${pastDate}: 89.8 kg`, { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(history.getByRole('listitem')).toHaveCount(1)
    await expect(
      history.getByText(
        'Shared with Synthetic draft group, Synthetic active group',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      history.getByText('Synthetic shared edit.', { exact: true }),
    ).toBeVisible()
    expect(await canonicalRows(page)).toEqual([
      expect.objectContaining({
        id: original.id,
        weightKg: 89.8,
        sharedChallengeIds: expectedShares,
      }),
    ])
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width)
  })
}

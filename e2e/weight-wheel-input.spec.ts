import { expect, test } from '@playwright/test'

const personalFixture = '/e2e/fixtures/personal-dashboard-harness.html'
const legacyFixture =
  '/e2e/fixtures/weigh-in-harness.html?challenge=challenge-1'

for (const width of [1280, 390]) {
  for (const surface of ['dialog', 'page'] as const) {
    for (const mode of ['create', 'edit'] as const) {
      test(`focused wheel preserves personal ${surface} ${mode} input at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ height: 900, width })
        const supabaseRequests: string[] = []
        page.on('request', (request) => {
          if (request.url().includes('.supabase.co/')) {
            supabaseRequests.push(request.url())
          }
        })
        const scenario = mode === 'create' ? 'groups' : 'accounts'
        const path = surface === 'page' ? '/weigh-ins' : '/dashboard'
        await page.goto(
          `${personalFixture}?${new URLSearchParams({ scenario, path })}`,
        )

        if (surface === 'dialog' && mode === 'create') {
          await page.getByRole('button', { name: 'Record weight' }).click()
        } else if (surface === 'dialog' && mode === 'edit') {
          await page.evaluate(() => {
            const entries = JSON.parse(
              localStorage.getItem('slimpossible.local.personal-weigh-ins') ??
                '[]',
            )
            const today = new Date()
            entries[0].date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            localStorage.setItem(
              'slimpossible.local.personal-weigh-ins',
              JSON.stringify(entries),
            )
          })
          await page.reload()
          await page.getByRole('button', { name: 'Record weight' }).click()
        } else if (mode === 'edit') {
          const date = await page
            .getByRole('list', { name: 'Personal weigh-in history' })
            .locator('time')
            .first()
            .getAttribute('datetime')
          await page
            .getByRole('button', { name: `Edit weight ${date}` })
            .click()
        }

        const editor =
          surface === 'dialog'
            ? page.getByRole('dialog')
            : page.getByRole('form', { name: 'Personal weigh-in form' })
        const weight = editor.getByLabel('Weight in kg')
        const baseline = mode === 'create' ? '81.2' : '82.3'
        await expect(weight).toHaveAttribute('inputmode', 'decimal')
        await weight.fill(baseline)
        const scrollBefore = await page.evaluate(() => window.scrollY)
        const box = (await weight.boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        const wheelDelta = scrollBefore > 0 ? -500 : 500
        await page.mouse.wheel(0, wheelDelta)
        await expect(weight).toHaveValue(baseline)
        await expect(weight).not.toBeFocused()
        if (surface === 'page') {
          await expect
            .poll(() => page.evaluate(() => window.scrollY))
            .not.toBe(scrollBefore)
        }

        const before = await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem('slimpossible.local.personal-weigh-ins') ??
              '[]',
          ),
        )
        await weight.focus()
        await weight.fill('')
        await page.keyboard.type('83.25')
        await expect(weight).toHaveValue('83.25')
        await weight.fill('0')
        await editor
          .getByRole('button', {
            name: mode === 'create' ? 'Save weight' : 'Update weight',
          })
          .click()
        await expect(
          editor.getByText('Weight must be a positive finite number.'),
        ).toBeVisible()
        expect(
          await page.evaluate(() =>
            JSON.parse(
              localStorage.getItem('slimpossible.local.personal-weigh-ins') ??
                '[]',
            ),
          ),
        ).toEqual(before)
        expect(supabaseRequests).toEqual([])
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width)
      })
    }
  }

  for (const mode of ['create', 'edit'] as const) {
    test(`focused wheel preserves legacy ${mode} input at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width })
      const supabaseRequests: string[] = []
      page.on('request', (request) => {
        if (request.url().includes('.supabase.co/')) {
          supabaseRequests.push(request.url())
        }
      })
      if (mode === 'edit') {
        await page.addInitScript(() => {
          const date = new Date().toISOString().slice(0, 10)
          localStorage.setItem(
            'slimpossible.local.weigh-ins',
            JSON.stringify([
              {
                date,
                note: 'Synthetic private note',
                participantId: 'participant-1',
                shareWithGroup: false,
                weightKg: 90,
              },
            ]),
          )
        })
      }
      await page.goto(legacyFixture)
      if (mode === 'edit') {
        const date = await page
          .locator('#daily-weigh-in-date')
          .getAttribute('max')
        await page.getByRole('button', { name: `Edit weight ${date}` }).click()
      }

      const weight = page.getByLabel('Weight in kg')
      const baseline = mode === 'create' ? '81.2' : '82.3'
      await expect(weight).toHaveAttribute('inputmode', 'decimal')
      await weight.fill(baseline)
      const scrollBefore = await page.evaluate(() => window.scrollY)
      const box = (await weight.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      const wheelDelta = scrollBefore > 0 ? -500 : 500
      await page.mouse.wheel(0, wheelDelta)
      await expect(weight).toHaveValue(baseline)
      await expect(weight).not.toBeFocused()
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .not.toBe(scrollBefore)

      const before = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem('slimpossible.local.weigh-ins') ?? '[]',
        ),
      )
      await weight.focus()
      await weight.fill('')
      await page.keyboard.type('83.25')
      await expect(weight).toHaveValue('83.25')
      await weight.fill('0')
      await page
        .getByRole('button', {
          name: mode === 'create' ? 'Save weight' : 'Update weight',
        })
        .click()
      await expect(
        page.getByText('Weight must be a positive finite number.'),
      ).toBeVisible()
      expect(
        await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem('slimpossible.local.weigh-ins') ?? '[]',
          ),
        ),
      ).toEqual(before)
      expect(supabaseRequests).toEqual([])
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    })
  }
}

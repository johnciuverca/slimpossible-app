import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const guide = readFileSync(
  resolve(process.cwd(), 'docs/release-verification.md'),
  'utf8',
)
const chapterChecklist = readFileSync(
  resolve(process.cwd(), 'docs/14-7-connected-release-checklist.md'),
  'utf8',
)
const deploymentHandoff = readFileSync(
  resolve(process.cwd(), 'docs/deployment.md'),
  'utf8',
)

describe('release verification guide', () => {
  it('separates injected CI checks from owner-run live verification', () => {
    expect(guide).toContain('CI and local verification')
    expect(guide).toContain('Owner-run live verification')
    expect(guide).toContain('session after a page refresh')
    expect(guide).toContain('public.profiles')
    expect(guide).toContain('anonymous requests cannot access')
  })

  it('does not permit secrets or production data in the verification path', () => {
    expect(guide).toContain('Never put a password, service-role key')
    expect(guide).toContain('dedicated non-production')
    expect(guide).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
  })

  it('keeps first connected release claims behind explicit staging and production gates', () => {
    expect(chapterChecklist).toContain(
      'Live staging journeys: **NOT EXECUTED**',
    )
    expect(chapterChecklist).toContain(
      'Staging migrations/configuration: **NOT INDEPENDENTLY VERIFIED**',
    )
    expect(chapterChecklist).toContain('Solo registration')
    expect(chapterChecklist).toContain('Group invitation')
    expect(chapterChecklist).toContain('Membership and privacy')
    expect(chapterChecklist).toContain('Keyboard and mobile')
    expect(chapterChecklist).toContain('Rollback and stop conditions')
    expect(chapterChecklist).toMatch(/Do not merge or\s+activate production/)
    expect(chapterChecklist).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
  })

  it('documents the connected deployment boundary without guessing owner settings', () => {
    expect(deploymentHandoff).toContain('connected app uses Supabase Auth')
    expect(deploymentHandoff).toMatch(
      /does not reveal or independently\s+verify the current Vercel environment values/,
    )
    expect(deploymentHandoff).toContain('14-7-connected-release-checklist.md')
    expect(deploymentHandoff).not.toContain('current local-only app')
  })
})

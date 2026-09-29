import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/quality.yml'),
  'utf8',
)
const guide = readFileSync(
  resolve(process.cwd(), 'docs/release-workflow.md'),
  'utf8',
)
const deployment = readFileSync(
  resolve(process.cwd(), 'docs/deployment.md'),
  'utf8',
)
const normalizedGuide = guide.replace(/\s+/g, ' ')

describe('persistent release workflow contract', () => {
  it('runs quality checks for PRs and pushes to main and staging', () => {
    expect(workflow).toMatch(
      /pull_request:\s*\n\s*branches:\s*\[main, staging\]/,
    )
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[main, staging\]/)
    expect(workflow).toContain('contents: read')
    expect(workflow).not.toMatch(/supabase\s+(db push|migration up)/i)
  })

  it('documents the exact owner-managed staging variables and redirects', () => {
    expect(guide).toContain(
      'Preview variables scoped to the Git branch staging',
    )
    expect(guide).toContain('VITE_SUPABASE_URL')
    expect(guide).toContain('VITE_SUPABASE_ANON_KEY')
    expect(guide).toContain('codex/13-6-implementation')
    expect(guide).toContain(
      'https://slimpossible-app-git-staging-cvc10.vercel.app/**',
    )
    expect(normalizedGuide).toContain('staging Supabase project only')
    expect(guide).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
  })

  it('preserves ancestry between release PRs and aligns staging afterward', () => {
    expect(guide).toContain('staging to main')
    expect(guide).toContain('merge commit')
    expect(guide).toContain('Do not squash or rebase')
    expect(guide).toContain('main → staging sync PR')
    expect(guide).toContain('Do not force-push, reset, or recreate')
  })

  it('lists reviewed migrations and keeps production approval manual', () => {
    for (const migration of [
      '20260917000000_create_core_schema.sql',
      '20260917000001_add_rls_policies.sql',
      '20260922000000_harden_rls_authorization.sql',
      '20260922000001_add_secure_challenge_invites.sql',
      '20260924000000_add_privacy_safe_group_progress.sql',
      '20260925000000_add_provisional_group_leader_summary.sql',
    ]) {
      expect(guide).toContain(migration)
    }

    expect(guide).toContain('$STAGING_DB_URL')
    expect(guide).toContain('$PRODUCTION_DB_URL')
    expect(guide).toContain('explicit owner approval')
    expect(normalizedGuide).toContain('before merging the release PR')
    expect(guide).toContain('This PR adds no database credentials')
    expect(guide).toContain('Do not copy staging data to production')
  })

  it('links the release guide from the existing deployment handoff', () => {
    expect(deployment).toContain(
      '[staging release workflow](release-workflow.md)',
    )
  })
})

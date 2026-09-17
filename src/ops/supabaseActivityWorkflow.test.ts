import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/supabase-activity.yml'),
  'utf8',
)

describe('Supabase activity workflow contract', () => {
  it('is scheduled, manually dispatchable, and read-only', () => {
    expect(workflow).toContain("cron: '17 3 * * 1'")
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('/auth/v1/health')
    expect(workflow).toContain('SUPABASE_URL')
    expect(workflow).toContain('SUPABASE_ANON_KEY')
    expect(workflow).toContain('apikey: ${SUPABASE_ANON_KEY}')
    expect(workflow).not.toMatch(/\b(insert|update|delete|post|patch)\b/i)
    expect(workflow).not.toContain('profiles')
    expect(workflow).not.toContain('weigh_ins')
  })

  it('does not print response bodies or credentials', () => {
    expect(workflow).toContain('--output /dev/null')
    expect(workflow).toContain("--write-out '%{http_code}'")
    expect(workflow).not.toContain('echo "$SUPABASE')
    expect(workflow).not.toContain('cat ')
  })
})

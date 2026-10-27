import { describe, expect, it } from 'vitest'
import {
  workspaceArea,
  workspaceSection,
  workspaceSectionLink,
} from './workspaceNavigation'

describe('workspace navigation', () => {
  it.each([
    ['dashboard', '/dashboard', '?tab=progress', '', 'progress'],
    ['dashboard', '/weigh-ins', '?challenge=group', '', 'weigh-ins'],
    ['dashboard', '/dashboard', '', '#goals', 'progress'],
    ['dashboard', '/dashboard', '', '#personal-history', 'weigh-ins'],
    ['group', '/group', '?tab=progress', '', 'charts'],
    ['group', '/group', '', '#group-progress', 'members'],
    ['group', '/group', '', '#group-history', 'charts'],
    ['group', '/group', '', '#weekly-winners-heading', 'weekly-results'],
    ['group', '/group', '?tab=unknown', '', 'overview'],
  ] as const)(
    'resolves supported sections and legacy links (%s %s %s %s)',
    (area, path, search, hash, expected) => {
      expect(workspaceSection(area, path, search, hash)).toBe(expected)
    },
  )

  it('preserves challenge and useful query state within a workspace', () => {
    expect(
      workspaceSectionLink(
        'group',
        'members',
        '?challenge=group%2Fone&source=invite&tab=charts',
      ),
    ).toBe('/group?challenge=group%2Fone&source=invite&tab=members')
    expect(
      workspaceSectionLink(
        'dashboard',
        'weigh-ins',
        '?source=old&tab=progress',
      ),
    ).toBe('/weigh-ins?source=old')
    expect(workspaceArea('/weigh-ins')).toBe('dashboard')
    expect(workspaceArea('/login')).toBeNull()
  })
})

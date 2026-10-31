export type WorkspaceArea = 'dashboard' | 'group'
export type WorkspaceSection =
  'overview' | 'weigh-ins' | 'members' | 'weekly-results' | 'charts'

export const workspaceSections = {
  dashboard: [
    { id: 'overview', label: 'Overview' },
    { id: 'weigh-ins', label: 'Weigh-ins' },
  ],
  group: [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'weekly-results', label: 'Weekly results' },
    { id: 'charts', label: 'Charts' },
  ],
} as const

export function workspaceArea(pathname: string): WorkspaceArea | null {
  if (pathname === '/group') return 'group'
  if (
    ['/', '/dashboard', '/weigh-ins', '/today', '/progress', '/goals'].includes(
      pathname,
    )
  )
    return 'dashboard'
  return null
}

export function workspaceSection(
  area: WorkspaceArea,
  pathname: string,
  search: string,
  hash = '',
): WorkspaceSection {
  if (area === 'dashboard' && pathname === '/weigh-ins') return 'weigh-ins'
  const tab = new URLSearchParams(search).get('tab')
  // Old combined pages appended anchors while retaining their current tab.
  // Honor those destinations; new section links deliberately clear the hash.
  if (area === 'group') {
    if (['#group-summary', '#group-progress-heading'].includes(hash))
      return 'overview'
    if (['#group-progress', '#members'].includes(hash)) return 'members'
    if (['#group-history', '#group-chart', '#charts'].includes(hash))
      return 'charts'
    if (
      [
        '#weekly-winners-heading',
        '#provisional-leader-heading',
        '#weekly-results',
      ].includes(hash)
    )
      return 'weekly-results'
  } else {
    if (hash === '#personal-history') return 'weigh-ins'
    if (['/progress', '/goals'].includes(pathname)) return 'overview'
    if (['#goals', '#dashboard-progress-panel'].includes(hash))
      return 'overview'
  }
  if (workspaceSections[area].some(({ id }) => id === tab))
    return tab as WorkspaceSection
  if (area === 'dashboard' && tab === 'progress') return 'overview'
  if (area === 'group' && tab === 'progress') return 'charts'
  return 'overview'
}

export function workspaceSectionLink(
  area: WorkspaceArea,
  section: WorkspaceSection,
  search: string,
) {
  const params = new URLSearchParams(search)
  const path =
    area === 'group'
      ? '/group'
      : section === 'weigh-ins'
        ? '/weigh-ins'
        : '/dashboard'
  if (section === 'weigh-ins') params.delete('tab')
  else params.set('tab', section)
  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}`
}

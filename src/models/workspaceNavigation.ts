export type WorkspaceArea = 'dashboard' | 'group'
export type WorkspaceSection =
  | 'overview'
  | 'weigh-ins'
  | 'progress'
  | 'members'
  | 'weekly-results'
  | 'charts'

export const workspaceSections = {
  dashboard: [
    { id: 'overview', label: 'Overview' },
    { id: 'weigh-ins', label: 'Weigh-ins' },
    { id: 'progress', label: 'Progress' },
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
  if (workspaceSections[area].some(({ id }) => id === tab))
    return tab as WorkspaceSection
  if (area === 'group') {
    if (tab === 'progress') return 'charts'
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
    if (
      ['/progress', '/goals'].includes(pathname) ||
      ['#goals', '#dashboard-progress-panel'].includes(hash)
    )
      return 'progress'
  }
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

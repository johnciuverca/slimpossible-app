import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  workspaceSection,
  workspaceSectionLink,
  workspaceSections,
  type WorkspaceArea,
} from '../models/workspaceNavigation'

export function ContextualSubnav({ area }: { area: WorkspaceArea }) {
  const { pathname, search, hash } = useLocation()
  const selected = workspaceSection(area, pathname, search, hash)
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = row.current
    const active = container?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    )
    if (!container || !active) return
    const item = active.getBoundingClientRect()
    const bounds = container.getBoundingClientRect()
    if (item.left < bounds.left) container.scrollLeft -= bounds.left - item.left
    else if (item.right > bounds.right)
      container.scrollLeft += item.right - bounds.right
  }, [area, selected])
  return (
    <nav
      aria-label={`${area === 'dashboard' ? 'Dashboard' : 'Group'} sections`}
      className="contextual-subnav"
    >
      <div className="contextual-subnav-scroll" ref={row}>
        <ul>
          {workspaceSections[area].map(({ id, label }) => (
            <li key={id}>
              <Link
                to={workspaceSectionLink(area, id, search)}
                aria-current={selected === id ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Challenge } from '../models/challenge'
import { workspaceSection } from '../models/workspaceNavigation'

export function GroupSwitcher({
  challenges,
  loading,
  error,
  canManageGroups = false,
}: {
  challenges: Challenge[]
  loading: boolean
  error: string
  canManageGroups?: boolean
}) {
  const { pathname, search, hash } = useLocation()
  const requested = new URLSearchParams(search).get('challenge')
  const groups = challenges.filter(
    (c) => c.kind === 'group' && c.status !== 'archived',
  )
  const routeSelected =
    pathname === '/group'
      ? (challenges.find((c) => c.kind === 'group' && c.id === requested) ??
        (!requested ? groups[0] : undefined))
      : undefined
  const [rememberedId, setRememberedId] = useState(() => {
    try {
      return window.localStorage.getItem('slimpossible:last-authorized-group')
    } catch {
      return null
    }
  })
  const selected =
    routeSelected ?? groups.find((group) => group.id === rememberedId)
  useEffect(() => {
    if (!routeSelected) return
    setRememberedId(routeSelected.id)
    try {
      window.localStorage.setItem(
        'slimpossible:last-authorized-group',
        routeSelected.id,
      )
    } catch {
      // Navigation still works when storage is unavailable.
    }
  }, [routeSelected?.id])
  useEffect(() => {
    if (loading || error) return
    if (rememberedId && !groups.some((group) => group.id === rememberedId)) {
      setRememberedId(null)
      try {
        window.localStorage.removeItem('slimpossible:last-authorized-group')
      } catch {
        // Ignore unavailable storage; the ID is never used without authorization.
      }
    }
  }, [error, groups, loading, rememberedId])
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const box = trigger.current?.getBoundingClientRect()
      if (!box || !panel.current) return
      const width = Math.min(300, window.innerWidth - 32)
      Object.assign(panel.current.style, {
        position: 'fixed',
        width: `${width}px`,
        right: 'auto',
        left: `${Math.max(16, Math.min(box.right - width, window.innerWidth - width - 16))}px`,
        top: `${box.bottom + 6}px`,
        maxHeight: `${Math.max(44, window.innerHeight - box.bottom - 22)}px`,
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])
  useEffect(() => {
    setOpen(false)
  }, [pathname, search, hash, loading, error])
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function close() {
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div
      className="group-switcher"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setOpen(true)
          requestAnimationFrame(() => {
            const links = Array.from(
              root.current?.querySelectorAll<HTMLAnchorElement>(
                '.group-switcher-panel a',
              ) ?? [],
            )
            const index = links.indexOf(
              document.activeElement as HTMLAnchorElement,
            )
            links[
              index === -1
                ? e.key === 'ArrowDown'
                  ? 0
                  : links.length - 1
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + links.length) %
                  links.length
            ]?.focus()
          })
        }
      }}
    >
      <div
        className="group-switcher-trigger"
        data-open={open ? 'true' : 'false'}
      >
        {selected ? (
          <Link
            to={`/group?${new URLSearchParams({ challenge: selected.id, tab: pathname === '/group' ? workspaceSection('group', pathname, search, hash) : 'overview' })}`}
            aria-label={`Open group: ${selected.name}`}
            aria-current={pathname === '/group' ? 'page' : undefined}
            title={selected.name}
            className="group-switcher-name"
          >
            {selected.name}
          </Link>
        ) : (
          <Link to="/group" className="group-switcher-name">
            Group
          </Link>
        )}
        <button
          ref={trigger}
          type="button"
          aria-label={`Choose group${selected ? `: ${selected.name}` : ''}`}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen(!open)}
          className="group-switcher-arrow"
        >
          <svg viewBox="0 0 12 10" width="12" height="10" fill="none">
            <path
              d="m2 3 4 4 4-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </button>
      </div>
      <div
        hidden={!open}
        ref={panel}
        id={id}
        className="group-switcher-panel"
        aria-label="Authorized groups"
      >
        {loading || error || groups.length === 0 ? (
          <Link to="/group" onClick={() => setOpen(false)}>
            Group overview
          </Link>
        ) : null}
        {loading ? (
          <p role="status">Loading authorized groups…</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : groups.length === 0 ? (
          <p>No active groups available.</p>
        ) : (
          groups.map((group) => {
            const params = new URLSearchParams(
              pathname === '/group' ? search : '',
            )
            params.set('challenge', group.id)
            params.set(
              'tab',
              pathname === '/group'
                ? workspaceSection('group', pathname, search, hash)
                : 'overview',
            )
            return (
              <Link
                key={group.id}
                to={`/group?${params}`}
                aria-current={group.id === selected?.id ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {group.name}
              </Link>
            )
          })
        )}
        {!loading && !error && canManageGroups ? (
          <>
            <hr className="group-switcher-divider" />
            <Link
              to="/challenge/manage"
              className="group-switcher-manage"
              onClick={() => setOpen(false)}
              title="Manage group challenges"
            >
              <svg
                aria-hidden="true"
                width="19"
                height="19"
                viewBox="0 0 28 28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.3 2.5h3.4l.6 2.2a9.7 9.7 0 0 1 1.8.8l2.1-1.1 2.4 2.4-1.1 2.1c.4.6.7 1.2.8 1.8l2.2.6v3.4l-2.2.6a9.7 9.7 0 0 1-.8 1.8l1.1 2.1-2.4 2.4-2.1-1.1c-.6.4-1.2.7-1.8.8l-.6 2.2h-3.4l-.6-2.2a9.7 9.7 0 0 1-1.8-.8l-2.1 1.1-2.4-2.4 1.1-2.1a9.7 9.7 0 0 1-.8-1.8l-2.2-.6v-3.4l2.2-.6a9.7 9.7 0 0 1 .8-1.8L5.4 6.8l2.4-2.4 2.1 1.1a9.7 9.7 0 0 1 1.8-.8l.6-2.2Z" />
                <circle cx="14" cy="13" r="3.4" />
              </svg>
              Manage groups
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}

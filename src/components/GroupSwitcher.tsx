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
  const selected =
    pathname === '/group'
      ? (challenges.find((c) => c.kind === 'group' && c.id === requested) ??
        (!requested ? groups[0] : undefined))
      : undefined
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
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose group${selected ? `: ${selected.name}` : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-current={pathname === '/group' ? 'page' : undefined}
        onClick={() => setOpen(!open)}
        className="group-switcher-trigger"
        title={selected?.name}
      >
        <span>{selected?.name ?? 'Group'}</span>
        <span className="account-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 10" width="12" height="10" fill="none">
            <path
              d="m2 3 4 4 4-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </span>
      </button>
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
              onClick={() => setOpen(false)}
              title="Manage group challenges"
            >
              Manage groups
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}

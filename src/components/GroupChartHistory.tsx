import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Persistence } from '../data/persistence'
import {
  createGroupChartHistory,
  createGroupHistoryMatrix,
  type GroupChartEntry,
} from '../models/groupChartHistory'
import { localDateOnly } from '../models/provisionalGroupLeader'

const colors = ['#166534', '#1d4ed8', '#9f1239', '#6b21a8', '#92400e']
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
const signed = (value: number) => `${value > 0 ? '+' : ''}${value} kg`

export function GroupChartHistory({
  challengeId,
  viewerId,
  persistence,
  refreshVersion,
  navigation,
  children,
  enabled = true,
}: {
  challengeId: string
  viewerId: string
  persistence: Persistence
  refreshVersion: number
  navigation?: ReactNode
  children?: ReactNode
  enabled?: boolean
}) {
  const key = `${viewerId}:${challengeId}:${refreshVersion}:${persistence.mode}`
  const context = `${viewerId}:${challengeId}:${persistence.mode}`
  const [selection, setSelection] = useState({ context, memberKey: '' })
  const tabs = useRef<HTMLDivElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const [snapshot, setSnapshot] = useState<{
    key: string
    state: 'success' | 'error'
    entries: GroupChartEntry[]
  } | null>(null)
  useEffect(() => {
    let current = true
    if (!enabled) return
    if (persistence.mode !== 'remote') {
      setSnapshot({ key, state: 'error', entries: [] })
      return
    }
    persistence.repositories.groupProgress
      .getChartHistory(challengeId)
      .then((result) => {
        if (current)
          setSnapshot({
            key,
            state: result.state === 'error' ? 'error' : 'success',
            entries: result.state === 'success' ? result.data : [],
          })
      })
      .catch(() => {
        if (current) setSnapshot({ key, state: 'error', entries: [] })
      })
    return () => {
      current = false
    }
  }, [challengeId, persistence, key, enabled])
  const data = snapshot?.key === key ? snapshot : null
  const allSeries = createGroupChartHistory(
    enabled ? (data?.entries ?? []) : [],
    localDateOnly(),
  )
  const selectedKey =
    selection.context === context &&
    allSeries.some((member) => member.memberKey === selection.memberKey)
      ? selection.memberKey
      : ''
  const series = selectedKey
    ? allSeries.filter((member) => member.memberKey === selectedKey)
    : allSeries
  const choices = [{ memberKey: '', label: 'All members' }, ...allSeries]
  const selectedIndex = choices.findIndex(
    (member) => member.memberKey === selectedKey,
  )
  const matrix = createGroupHistoryMatrix(series)
  useEffect(() => {
    if (selection.context !== context) {
      setSelection({ context, memberKey: '' })
      return
    }
    if (
      data?.state === 'success' &&
      selection.context === context &&
      selection.memberKey &&
      !data.entries.some((entry) => entry.memberKey === selection.memberKey)
    ) {
      setSelection({ context, memberKey: '' })
    }
  }, [data, context, selection])
  useEffect(() => {
    const element = navigationRef.current
    if (!element) return
    const update = () =>
      workspace.current?.style.setProperty(
        '--group-navigation-height',
        `${element.getBoundingClientRect().height}px`,
      )
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const points = series.flatMap((member) => member.points)
  const dates = points.map((point) => day(point.date))
  const start = Math.min(...dates)
  const end = Math.max(...dates)
  const changes = points.map((point) => point.changeKg)
  const min = Math.min(0, ...changes) - 0.5
  const max = Math.max(0, ...changes) + 0.5
  const x = (date: string) =>
    65 + ((day(date) - start) / Math.max(1, end - start)) * 610
  const y = (value: number) => 25 + ((max - value) / (max - min)) * 190
  return (
    <div ref={workspace} className="group-history-workspace min-w-0 space-y-6">
      <div
        ref={navigationRef}
        className="sticky top-0 z-20 min-w-0 rounded-xl border border-stone-200 bg-page shadow-sm"
      >
        {navigation ? (
          <div className="max-h-[32dvh] overflow-y-auto p-3 sm:p-4">
            {navigation}
          </div>
        ) : null}
        <div
          ref={tabs}
          role="tablist"
          aria-label="Shared group members"
          className="app-nav-scroll flex max-w-full gap-2 overflow-x-auto p-3"
        >
          {choices.map((member, index) => (
            <button
              key={member.memberKey}
              id={`${id}-tab-${index}`}
              role="tab"
              aria-selected={selectedIndex === index}
              aria-controls={enabled ? `${id}-panel` : undefined}
              disabled={!enabled}
              tabIndex={selectedIndex === index ? 0 : -1}
              type="button"
              className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${selectedIndex === index ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-stone-300 bg-white text-emerald-800'}`}
              onClick={() =>
                setSelection({ context, memberKey: member.memberKey })
              }
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % choices.length
                    : event.key === 'ArrowLeft'
                      ? (index - 1 + choices.length) % choices.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? choices.length - 1
                          : null
                if (next === null) return
                event.preventDefault()
                setSelection({ context, memberKey: choices[next].memberKey })
                const buttons =
                  tabs.current?.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  )
                buttons?.item(next).focus()
              }}
            >
              {member.label}
            </button>
          ))}
        </div>
      </div>
      {children}
      {enabled ? (
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${selectedIndex}`}
          tabIndex={0}
        >
          <section
            aria-labelledby="group-history-heading"
            className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 sm:p-7"
          >
            <h2
              id="group-history-heading"
              className="text-xl font-bold text-slate-900"
            >
              Group chart and weigh-in history
            </h2>
            {selectedKey ? (
              <p className="mt-2 font-semibold">
                {series[0].label} · shared with this group only
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Explicitly shared dates and weights only. Change is measured in kg
              from each member’s first shared entry, not their private starting
              weight. Negative means loss; positive means gain. This chart is
              not a winner ranking. Notes and emails are never included.
            </p>
            {!data ? (
              <p role="status" className="mt-4">
                Loading shared group history…
              </p>
            ) : data.state === 'error' ? (
              <p role="status" className="mt-4 text-red-800">
                Shared group history is unavailable. Refresh shared progress to
                retry.
              </p>
            ) : series.length === 0 ? (
              <p className="mt-4">
                No entries have been shared with this group.
              </p>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-700">
                  Missing dates are gaps, not estimated weights. A single shared
                  entry establishes a zero-change baseline. Late entries,
                  corrections and removed shares recalculate the baseline on
                  refresh.
                </p>
                <div
                  role="region"
                  aria-label="Scrollable group comparison chart"
                  tabIndex={0}
                  className="mt-4 overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  <svg
                    viewBox="0 0 720 265"
                    role="img"
                    aria-labelledby="group-chart-title group-chart-description"
                    className="w-full min-w-[36rem]"
                  >
                    <title id="group-chart-title">
                      Change from first shared weight (kg)
                    </title>
                    <desc id="group-chart-description">
                      Each member has their own zero baseline. Points represent
                      shared recorded dates. Lines connect only consecutive
                      days. The table below provides every date, exact weight
                      and kg change.
                    </desc>
                    {[min, 0, max].map((value) => (
                      <g key={value}>
                        <line
                          x1={65}
                          x2={675}
                          y1={y(value)}
                          y2={y(value)}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={60}
                          y={y(value) + 4}
                          textAnchor="end"
                          fontSize={12}
                        >
                          {signed(Math.round(value * 100) / 100)}
                        </text>
                      </g>
                    ))}
                    {series.map((member, index) => (
                      <g
                        key={member.memberKey}
                        stroke={colors[index % colors.length]}
                        fill={colors[index % colors.length]}
                      >
                        {member.points.map((point, position) => {
                          const previous = member.points[position - 1]
                          return (
                            <g key={point.date}>
                              {previous &&
                              day(point.date) - day(previous.date) === 1 ? (
                                <line
                                  x1={x(previous.date)}
                                  y1={y(previous.changeKg)}
                                  x2={x(point.date)}
                                  y2={y(point.changeKg)}
                                  strokeWidth={2}
                                  strokeDasharray={
                                    index % 2 ? '5 3' : undefined
                                  }
                                />
                              ) : null}
                              <circle
                                cx={x(point.date)}
                                cy={y(point.changeKg)}
                                r={4}
                              >
                                <title>
                                  {member.label}: {point.date},{' '}
                                  {signed(point.changeKg)}
                                </title>
                              </circle>
                            </g>
                          )
                        })}
                      </g>
                    ))}
                    <text x={65} y={242} fontSize={12}>
                      {new Date(start * 86400000).toISOString().slice(0, 10)}
                    </text>
                    <text x={675} y={242} textAnchor="end" fontSize={12}>
                      {new Date(end * 86400000).toISOString().slice(0, 10)}
                    </text>
                  </svg>
                </div>
                <ul
                  aria-label="Group chart legend"
                  className="mt-3 flex flex-wrap gap-3 text-sm"
                >
                  {series.map((member, index) => (
                    <li key={member.memberKey}>
                      <span
                        aria-hidden="true"
                        style={{ color: colors[index % colors.length] }}
                      >
                        ●{' '}
                      </span>
                      {member.label} · baseline{' '}
                      <time dateTime={member.baselineDate}>
                        {member.baselineDate}
                      </time>
                    </li>
                  ))}
                </ul>
                <div
                  role="region"
                  aria-label="Scrollable shared group weights"
                  tabIndex={0}
                  className="mt-5 max-h-[28rem] overflow-auto rounded-xl border border-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  <table
                    aria-label="Shared group weight history"
                    className="w-full min-w-[36rem] border-collapse text-left text-sm"
                  >
                    <caption className="p-3 text-left font-semibold">
                      Exact shared weights (kg). A dash means no shared entry.
                    </caption>
                    <thead className="bg-stone-50">
                      <tr>
                        <th
                          scope="col"
                          className="sticky left-0 top-0 z-10 bg-stone-50 px-4 py-3"
                        >
                          Recorded date
                        </th>
                        {series.map((member) => (
                          <th
                            key={member.memberKey}
                            scope="col"
                            className="sticky top-0 bg-stone-50 px-4 py-3"
                          >
                            {member.label} (kg)
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {matrix.map((row) => (
                        <tr key={row.date}>
                          <th
                            scope="row"
                            className="sticky left-0 bg-white px-4 py-3 font-medium"
                          >
                            <time dateTime={row.date}>{row.date}</time>
                          </th>
                          {row.cells.map((point, index) => (
                            <td
                              key={series[index].memberKey}
                              className="relative px-4 py-3"
                            >
                              {point ? (
                                <>
                                  <span className="whitespace-nowrap">
                                    {point.weightKg} kg
                                  </span>
                                  <span className="sr-only">
                                    ; change from first shared entry{' '}
                                    {signed(point.changeKg)}
                                  </span>
                                </>
                              ) : (
                                <span aria-label="No shared entry">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}

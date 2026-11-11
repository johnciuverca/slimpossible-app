import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Persistence } from '../data/persistence'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import { ownGroupMemberKey } from '../models/ownGroupMemberKey'
import { WeightEntryActions } from './WeightEntryActions'
import {
  createGroupChartHistory,
  createGroupHistoryMatrix,
  type GroupChartEntry,
} from '../models/groupChartHistory'
import { localDateOnly } from '../models/provisionalGroupLeader'
import { formatChartDate } from '../models/chartDate'
import { WeightEntryCard } from './WeightEntryCard'
import { deriveGroupChartTrend } from '../models/groupChartTrend'
import type { GroupMemberProgress } from '../models/groupMemberProgress'
import { createGroupMemberChartColorMap } from '../models/groupMemberChartColors'
import { SharedWeightChart } from './SharedWeightChart'
import { interpolateMissingWeights } from '../models/estimatedWeighIns'
import {
  ChartWeightPointEditor,
  type ChartWeightPointSelection,
} from './ChartWeightPointEditor'

const trendColor = '#ffbf69'
const referenceColor = '#c49cff'
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
const signed = (value: number) => `${value > 0 ? '+' : ''}${value} kg`
const formatWeight = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)

export function GroupChartHistory({
  challengeId,
  viewerId,
  persistence,
  refreshVersion,
  children,
  enabled = true,
  showHistory = true,
  compactOverview = false,
  memberProgress = [],
}: {
  challengeId: string
  viewerId: string
  persistence: Persistence
  refreshVersion: number
  children?: ReactNode
  enabled?: boolean
  showHistory?: boolean
  compactOverview?: boolean
  memberProgress?: GroupMemberProgress[]
}) {
  const ownMemberKey = ownGroupMemberKey(challengeId, viewerId)
  const personalWorkspace = usePersonalWorkspace({
    enabled: enabled && ownMemberKey !== null,
  })
  const [localHistoryRefresh, setLocalHistoryRefresh] = useState(0)
  const key = `${viewerId}:${challengeId}:${refreshVersion}:${localHistoryRefresh}:${persistence.mode}`
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
  const [chartAction, setChartAction] = useState<
    (ChartWeightPointSelection & { context: string }) | null
  >(null)
  const activeChartAction =
    chartAction?.context === context ? chartAction : null
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
  const memberColors = createGroupMemberChartColorMap(
    allSeries.map((member) => member.memberKey),
  )
  const selectedKey =
    selection.context === context &&
    allSeries.some((member) => member.memberKey === selection.memberKey)
      ? selection.memberKey
      : ''
  const series = selectedKey
    ? allSeries.filter((member) => member.memberKey === selectedKey)
    : allSeries
  const chartViewBoxHeight = 266 + Math.max(0, series.length - 1) * 12
  const choices = [{ memberKey: '', label: 'All members' }, ...allSeries]
  const selectedIndex = choices.findIndex(
    (member) => member.memberKey === selectedKey,
  )
  const matrix = createGroupHistoryMatrix(series)
  const trends = series.map((member) => ({
    memberKey: member.memberKey,
    trend: deriveGroupChartTrend(member.points),
  }))
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
  const weights = points.map((point) => point.weightKg)
  const chartValue = (weightKg: number) => weightKg
  const targetWeights = series.flatMap((member) => {
    const target = memberProgress.find(
      (candidate) => candidate.memberKey === member.memberKey,
    )?.targetWeightKg
    return target !== null && target !== undefined && Number.isFinite(target)
      ? [chartValue(target)]
      : []
  })
  const trendWeights = trends.flatMap(({ trend }) =>
    trend
      ? [chartValue(trend.startWeightKg), chartValue(trend.endWeightKg)]
      : [],
  )
  const weightMin = Math.min(...weights, ...targetWeights, ...trendWeights)
  const weightMax = Math.max(...weights, ...targetWeights, ...trendWeights)
  const padding = Math.max(0.5, (weightMax - weightMin) * 0.05)
  const min = Math.max(0, weightMin - padding)
  const max = weightMax + padding
  const ticks = [min, (min + max) / 2, max]
  const pointValue = (point: (typeof points)[number]) => point.weightKg
  const plotLeft = 100
  const x = (date: string) =>
    plotLeft +
    ((day(date) - start) / Math.max(1, end - start)) * (675 - plotLeft)
  const y = (value: number) => 25 + ((max - value) / (max - min)) * 190
  return (
    <div
      id="group-history"
      ref={workspace}
      className={`group-history-workspace min-w-0 scroll-mt-6 ${compactOverview ? 'space-y-2' : 'space-y-6'}`}
    >
      {children}
      {showHistory && !compactOverview ? (
        <div
          ref={navigationRef}
          className="sticky top-0 z-20 min-w-0 rounded-xl border border-stone-200 bg-page shadow-sm"
        >
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
                className={`group-member-tab min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${selectedIndex === index ? 'group-member-tab-active border-emerald-800 bg-emerald-800 text-white' : 'border-stone-300 bg-white text-emerald-800'}`}
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
      ) : null}
      {enabled && (showHistory || compactOverview) ? (
        <div
          id={`${id}-panel`}
          role={compactOverview ? undefined : 'tabpanel'}
          aria-labelledby={
            compactOverview ? undefined : `${id}-tab-${selectedIndex}`
          }
          tabIndex={0}
        >
          <section
            aria-labelledby={`${id}-history-heading`}
            className={`min-w-0 rounded-2xl border border-stone-200 bg-white ${compactOverview ? 'p-3 sm:p-5' : 'p-5 sm:p-7'}`}
          >
            <h2
              id={`${id}-history-heading`}
              className={
                compactOverview ? 'sr-only' : 'text-xl font-bold text-slate-900'
              }
            >
              {compactOverview
                ? 'Group weight chart'
                : 'Group chart and weigh-in history'}
            </h2>
            {selectedKey ? (
              <p className="mt-2 font-semibold">
                {series[0].label} · shared with this group only
              </p>
            ) : null}
            <p className="sr-only">
              Explicitly shared dates and weights only. All members and
              individual charts plot actual shared Weight (kg). A lower absolute
              weight is not a winner ranking. Notes and emails are never
              included.
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
                <p className="sr-only">
                  Hollow points estimate missing dates only between a member’s
                  explicitly shared entries. Each member starts at their first
                  explicitly shared weight; unshared starting values are not
                  added. Estimates are visual only. Corrections and removed
                  shares update this chart on refresh.
                </p>
                <div
                  role="region"
                  aria-label="Group comparison chart"
                  tabIndex={0}
                  className="mt-4 min-w-0 focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  <SharedWeightChart
                    compactOlderHistory={!selectedKey}
                    title="Weight (kg) — shared group history"
                    description={`Each member is plotted at their actual shared weight in kilograms. ${selectedKey ? 'Points represent shared dates; lines connect only consecutive days.' : 'The latest 7 calendar dates stay detailed. Larger older points show Monday–Sunday averages of actual shared records; activate them to expand daily points.'}${compactOverview ? '' : ' The table below provides every exact recorded weight.'}`}
                    yLabel="Weight (kg)"
                    min={min}
                    max={max}
                    maxTicks={8}
                    paddingRatio={0.05}
                    paddingMinimum={0.5}
                    floorAtZero
                    includeZero={false}
                    className="w-full min-w-0"
                    viewBox={`0 0 760 ${chartViewBoxHeight}`}
                    fitContainer
                    labelSeriesExtremesOnly
                    series={series.map((member) => ({
                      id: member.memberKey,
                      color: memberColors.get(member.memberKey)!,
                      title: `${member.label} recorded shared weights`,
                      points: [
                        ...member.points.map((point) => ({
                          date: point.date,
                          value: pointValue(point),
                          label: String(point.weightKg),
                          title: `${member.label}: ${formatChartDate(point.date)}, ${point.weightKg} kg`,
                          markerLabel: `Recorded weight for ${member.label} on ${formatChartDate(point.date)}`,
                          tooltip: `${member.label} — ${formatChartDate(point.date)}: ${formatWeight(point.weightKg)} kg`,
                        })),
                        ...interpolateMissingWeights(
                          member.points.map((point) => ({
                            date: point.date,
                            weightKg: point.weightKg,
                          })),
                        ).map((point) => ({
                          date: point.date,
                          value: point.weightKg,
                          estimated: true,
                          title: `${member.label}: Estimated ${formatChartDate(point.date)}, ${formatWeight(point.weightKg)} kg`,
                          markerLabel: `Estimated weight for ${member.label} on ${formatChartDate(point.date)}`,
                          tooltip: `${member.label} — Estimated ${formatChartDate(point.date)}: ${formatWeight(point.weightKg)} kg`,
                        })),
                      ].sort((a, b) => a.date.localeCompare(b.date)),
                    }))}
                    onPointActivate={(point, memberKey) => {
                      if (
                        memberKey !== ownMemberKey ||
                        personalWorkspace.userId !== viewerId.toLowerCase()
                      )
                        return
                      if (point.estimated) {
                        setChartAction({
                          context,
                          date: point.date,
                          value: point.value,
                          estimated: true,
                        })
                      } else
                        setChartAction({
                          context,
                          date: point.date,
                          value: point.value,
                          estimated: false,
                        })
                    }}
                    lines={[
                      ...series.flatMap((member) => {
                        const target = memberProgress.find(
                          (candidate) =>
                            candidate.memberKey === member.memberKey,
                        )?.targetWeightKg
                        return target === null ||
                          target === undefined ||
                          !Number.isFinite(target)
                          ? []
                          : [
                              {
                                id: `target:${member.memberKey}`,
                                from: {
                                  date: member.points[0].date,
                                  value: chartValue(target),
                                },
                                to: {
                                  date: member.points.at(-1)!.date,
                                  value: chartValue(target),
                                },
                                color: referenceColor,
                                title: `${member.label} target reference: ${target} kg`,
                                kind: 'reference' as const,
                              },
                            ]
                      }),
                      ...trends.flatMap(({ memberKey, trend }) =>
                        trend
                          ? [
                              {
                                id: `trend:${memberKey}`,
                                from: {
                                  date: trend.startDate,
                                  value: chartValue(trend.startWeightKg),
                                },
                                to: {
                                  date: trend.endDate,
                                  value: chartValue(trend.endWeightKg),
                                },
                                color: trendColor,
                                title: `${series.find((member) => member.memberKey === memberKey)?.label ?? 'Member'} derived trend from displayed shared points`,
                                kind: 'trend' as const,
                              },
                            ]
                          : [],
                      ),
                    ]}
                  />
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 720 265"
                    role="img"
                    aria-labelledby={`${id}-chart-title`}
                    aria-describedby={`${id}-chart-description`}
                    className="hidden"
                  >
                    <title id={`${id}-chart-title`}>
                      Weight (kg) — shared group history
                    </title>
                    <desc id={`${id}-chart-description`}>
                      Each member is plotted at their actual shared weight in
                      kilograms. Points represent shared dates; lines connect
                      only consecutive days. The table below provides every
                      exact recorded weight.
                    </desc>
                    <text x={plotLeft} y={14} fontSize={12}>
                      Weight (kg)
                    </text>
                    {ticks.map((value) => (
                      <g key={value}>
                        <line
                          x1={plotLeft}
                          x2={675}
                          y1={y(value)}
                          y2={y(value)}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={plotLeft - 5}
                          y={y(value) + 4}
                          textAnchor="end"
                          fontSize={12}
                        >
                          {`${Math.round(value * 100) / 100} kg`}
                        </text>
                      </g>
                    ))}
                    {series.map((member) => {
                      const target = memberProgress.find(
                        (candidate) => candidate.memberKey === member.memberKey,
                      )?.targetWeightKg
                      return target === null || target === undefined ? null : (
                        <line
                          key={`target:${member.memberKey}`}
                          data-series="target-reference"
                          x1={plotLeft}
                          x2={675}
                          y1={y(chartValue(target))}
                          y2={y(chartValue(target))}
                          stroke={referenceColor}
                          strokeWidth={2}
                          strokeDasharray="8 5"
                        >
                          <title>
                            {member.label} target reference: {target} kg
                          </title>
                        </line>
                      )
                    })}
                    {series.map((member) => (
                      <g
                        key={member.memberKey}
                        stroke={memberColors.get(member.memberKey)}
                        fill={memberColors.get(member.memberKey)}
                      >
                        {trends.find(
                          (item) => item.memberKey === member.memberKey,
                        )?.trend ? (
                          <line
                            data-series="derived-trend"
                            x1={x(
                              trends.find(
                                (item) => item.memberKey === member.memberKey,
                              )!.trend!.startDate,
                            )}
                            y1={y(
                              chartValue(
                                trends.find(
                                  (item) => item.memberKey === member.memberKey,
                                )!.trend!.startWeightKg,
                              ),
                            )}
                            x2={x(
                              trends.find(
                                (item) => item.memberKey === member.memberKey,
                              )!.trend!.endDate,
                            )}
                            y2={y(
                              chartValue(
                                trends.find(
                                  (item) => item.memberKey === member.memberKey,
                                )!.trend!.endWeightKg,
                              ),
                            )}
                            stroke={trendColor}
                            strokeWidth={2.5}
                            strokeDasharray="2 5"
                            strokeLinecap="round"
                          >
                            <title>
                              {member.label} derived trend from displayed shared
                              points
                            </title>
                          </line>
                        ) : null}
                        {member.points.map((point, position) => {
                          const previous = member.points[position - 1]
                          return (
                            <g key={point.date}>
                              {previous &&
                              day(point.date) - day(previous.date) === 1 ? (
                                <line
                                  data-series="recorded-connection"
                                  x1={x(previous.date)}
                                  y1={y(pointValue(previous))}
                                  x2={x(point.date)}
                                  y2={y(pointValue(point))}
                                  strokeWidth={2}
                                />
                              ) : null}
                              <circle
                                cx={x(point.date)}
                                cy={y(pointValue(point))}
                                r={4}
                              >
                                <title>
                                  {member.label}: {formatChartDate(point.date)},{' '}
                                  {point.weightKg} kg
                                </title>
                              </circle>
                            </g>
                          )
                        })}
                      </g>
                    ))}
                    <text x={plotLeft} y={242} fontSize={12}>
                      {formatChartDate(
                        new Date(start * 86400000).toISOString().slice(0, 10),
                      )}
                    </text>
                    <text x={675} y={242} textAnchor="end" fontSize={12}>
                      {formatChartDate(
                        new Date(end * 86400000).toISOString().slice(0, 10),
                      )}
                    </text>
                  </svg>
                </div>
                <ul
                  aria-label="Group chart legend"
                  className="mt-3 flex w-full flex-wrap justify-center gap-x-5 gap-y-2 text-sm"
                >
                  {series.map((member) => (
                    <li
                      key={member.memberKey}
                      className="flex items-center gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block w-6 border-t-2"
                        style={{
                          borderColor: memberColors.get(member.memberKey),
                        }}
                      />
                      {member.label}
                    </li>
                  ))}
                </ul>
                {!compactOverview ? (
                  <div
                    role="region"
                    aria-label="Scrollable shared group weights"
                    tabIndex={0}
                    className="relative isolate mt-5 max-h-[28rem] overflow-auto rounded-xl border border-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"
                  >
                    <table
                      aria-label="Shared group weight history"
                      className="group-history-table table-fixed border-collapse text-left text-xs"
                      style={{ width: 120 + series.length * 156 }}
                    >
                      <colgroup>
                        <col style={{ width: 120 }} />
                        {series.map((member) => (
                          <col key={member.memberKey} style={{ width: 156 }} />
                        ))}
                      </colgroup>
                      <caption className="p-3 text-left font-semibold">
                        Exact shared weights (kg). A dash means no shared entry.
                      </caption>
                      <thead className="bg-stone-50">
                        <tr>
                          <th
                            scope="col"
                            aria-label="Recorded date"
                            className="sticky left-0 top-0 z-30 bg-stone-50 px-2 py-2"
                          >
                            Date
                          </th>
                          {series.map((member) => (
                            <th
                              key={member.memberKey}
                              scope="col"
                              className="sticky top-0 z-20 break-words bg-stone-50 px-1 py-2"
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
                              aria-label={row.date}
                              className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 font-medium"
                            >
                              <time dateTime={row.date} title={row.date}>
                                {row.date}
                              </time>
                            </th>
                            {row.cells.map((point, index) => (
                              <td
                                key={series[index].memberKey}
                                className="relative z-0 px-1 py-1"
                              >
                                {point ? (
                                  <>
                                    <WeightEntryCard weightKg={point.weightKg}>
                                      <span className="sr-only">
                                        ; change from first shared entry{' '}
                                        {signed(point.changeKg)}
                                      </span>
                                      {point.memberKey === ownMemberKey &&
                                      personalWorkspace.userId ===
                                        viewerId.toLowerCase() &&
                                      personalWorkspace.persistence.mode ===
                                        'remote' &&
                                      personalWorkspace.personal.state ===
                                        'ready' &&
                                      personalWorkspace.contexts.state ===
                                        'ready' ? (
                                        <WeightEntryActions
                                          key={`${personalWorkspace.ownerKey}:${challengeId}:${point.date}`}
                                          workspace={personalWorkspace}
                                          date={point.date}
                                          compact
                                          memberLabel={series[index].label}
                                          requiredSharedChallengeId={
                                            challengeId
                                          }
                                        />
                                      ) : null}
                                    </WeightEntryCard>{' '}
                                    <span className="block text-[10px] text-ink-muted">
                                      Previous shared entry:{' '}
                                      {point.previousSharedChangeKg === null
                                        ? '—'
                                        : signed(point.previousSharedChangeKg)}
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
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
      <ChartWeightPointEditor
        workspace={personalWorkspace}
        point={activeChartAction}
        requiredSharedChallengeId={challengeId}
        scopeKey={`group-chart:${challengeId}:${viewerId}`}
        onClose={() => setChartAction(null)}
        onSaved={() => {
          setChartAction(null)
          personalWorkspace.refresh()
          setLocalHistoryRefresh((version) => version + 1)
        }}
        onDuplicateDate={() => {
          personalWorkspace.refresh()
          setLocalHistoryRefresh((version) => version + 1)
        }}
      />
    </div>
  )
}

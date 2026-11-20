import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Persistence } from '../data/persistence'
import { usePersonalWorkspace } from '../data/usePersonalWorkspace'
import { ownGroupMemberKey } from '../models/ownGroupMemberKey'
import { WeightEntryActions } from './WeightEntryActions'
import {
  createGroupChartHistory,
  type GroupChartEntry,
} from '../models/groupChartHistory'
import { localDateOnly } from '../models/provisionalGroupLeader'
import { formatChartDate } from '../models/chartDate'
import { WeightEntryCard } from './WeightEntryCard'
import { deriveGroupChartTrend } from '../models/groupChartTrend'
import type { GroupMemberProgress } from '../models/groupMemberProgress'
import { createGroupMemberChartColorMap } from '../models/groupMemberChartColors'
import { SharedWeightChart } from './SharedWeightChart'
import { GroupParticipantAvatar } from './GroupParticipantAvatar'
import { sharedChartTheme } from './sharedChartTheme'
import {
  estimatedHistoryDatePageForSeries,
  interpolateMissingWeights,
  interpolateMissingWeightsForDates,
} from '../models/estimatedWeighIns'
import {
  ChartWeightPointEditor,
  type ChartWeightPointSelection,
} from './ChartWeightPointEditor'

const noHiddenMembers = new Set<string>()
const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
const signed = (value: number) =>
  value === 0 || Object.is(value, -0)
    ? '0 kg'
    : `${value > 0 ? '+' : ''}${value} kg`
const sharedChangeColor = (changeKg: number | null, records = false) =>
  changeKg === null || changeKg === 0 || Object.is(changeKg, -0)
    ? 'text-ink'
    : changeKg < 0
      ? 'text-forest-800'
      : records
        ? 'text-record-gain'
        : 'text-danger-800'
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
  view = 'combined',
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
  view?: 'combined' | 'charts' | 'records'
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
  const [hiddenMemberState, setHiddenMemberState] = useState<{
    context: string
    memberKeys: Set<string>
  }>({ context, memberKeys: new Set() })
  const hiddenMemberKeys =
    hiddenMemberState.context === context
      ? hiddenMemberState.memberKeys
      : noHiddenMembers
  const tabs = useRef<HTMLDivElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const showCharts = view !== 'records'
  const showRecords = !compactOverview && view !== 'charts'
  const [snapshot, setSnapshot] = useState<{
    key: string
    state: 'success' | 'error'
    entries: GroupChartEntry[]
  } | null>(null)
  const [chartAction, setChartAction] = useState<
    (ChartWeightPointSelection & { context: string }) | null
  >(null)
  const [recordPageIndex, setRecordPageIndex] = useState(0)
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
  const recordPage = estimatedHistoryDatePageForSeries(
    series.map((member) => member.points),
    recordPageIndex,
  )
  const actualPointsByMember = series.map(
    ({ points }) => new Map(points.map((point) => [point.date, point])),
  )
  const estimatedPointsByMember = series.map(
    ({ points }) =>
      new Map(
        interpolateMissingWeightsForDates(points, recordPage.dates).map(
          (point) => [point.date, point],
        ),
      ),
  )
  const matrix = recordPage.dates.map((date) => ({
    date,
    cells: series.map((member, index) => {
      const actual = actualPointsByMember[index].get(date)
      if (actual) return { ...actual, estimated: false as const }
      const estimate = estimatedPointsByMember[index].get(date)
      return estimate
        ? {
            date,
            displayName: member.label,
            memberKey: member.memberKey,
            weightKg: estimate.weightKg,
            estimated: true as const,
          }
        : null
    }),
  }))
  const avatarByMemberKey = new Map(
    memberProgress.map((member) => [member.memberKey, member]),
  )
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
    setRecordPageIndex(0)
  }, [context, selectedKey])
  useEffect(() => {
    if (recordPage.pageIndex !== recordPageIndex)
      setRecordPageIndex(recordPage.pageIndex)
  }, [recordPage.pageIndex, recordPageIndex])
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
            className={`app-nav-scroll flex min-w-0 gap-2 overflow-x-auto p-3 ${view === 'records' ? 'w-full items-stretch' : 'max-w-full'}`}
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
                className={`group-member-tab min-h-11 rounded-full border py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${view === 'records' ? 'min-w-[104px] flex-[1_0_104px] whitespace-normal break-words px-2 text-center' : 'shrink-0 whitespace-nowrap px-4'} ${selectedIndex === index ? 'group-member-tab-active border-emerald-800 bg-emerald-800 text-white' : 'border-stone-300 bg-white text-emerald-800'}`}
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
                {view === 'records' ? (
                  <span
                    data-member-tab-content
                    className="flex w-full min-w-0 items-center justify-center gap-1"
                  >
                    {member.memberKey ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="inline-block w-4 shrink-0 border-t-2"
                          style={{
                            borderColor: memberColors.get(member.memberKey),
                          }}
                        />
                        <GroupParticipantAvatar
                          avatarPresetId={
                            avatarByMemberKey.get(member.memberKey)
                              ?.avatarPresetId
                          }
                          displayName={member.label}
                          className="h-6! w-6! text-xs!"
                        />
                      </>
                    ) : null}
                    <span className="min-w-0 break-words">{member.label}</span>
                  </span>
                ) : (
                  member.label
                )}
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
                : view === 'charts'
                  ? 'Group charts'
                  : view === 'records'
                    ? 'Group record history'
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
                {showCharts ? (
                  <>
                    <p className="sr-only">
                      Hollow points estimate missing dates only between a
                      member’s explicitly shared entries. Each member starts at
                      their first explicitly shared weight; unshared starting
                      values are not added. Estimates are visual only.
                      Corrections and removed shares update this chart on
                      refresh.
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
                        description={`Each member is plotted at their actual shared weight in kilograms. ${selectedKey ? 'Points represent shared dates; lines connect only consecutive days.' : 'The latest 7 calendar dates stay detailed. Larger older points show Monday–Sunday averages of actual shared records; activate them to expand daily points.'}${compactOverview ? '' : ' The Records tab provides exact shared weights and labels estimates between them.'}`}
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
                        hiddenSeriesIds={
                          selectedKey ? noHiddenMembers : hiddenMemberKeys
                        }
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
                              tooltip: (
                                <>
                                  {member.label} —{' '}
                                  <span className="whitespace-nowrap">
                                    {formatChartDate(point.date)}:{' '}
                                    {formatWeight(point.weightKg)} kg
                                  </span>
                                </>
                              ),
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
                              tooltip: (
                                <>
                                  {member.label} — Estimated{' '}
                                  <span className="whitespace-nowrap">
                                    {formatChartDate(point.date)}:{' '}
                                    {formatWeight(point.weightKg)} kg
                                  </span>
                                </>
                              ),
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
                        canEditPoint={(_point, memberKey) =>
                          memberKey === ownMemberKey &&
                          personalWorkspace.userId === viewerId.toLowerCase()
                        }
                        lines={[
                          ...trends.flatMap(({ memberKey, trend }) =>
                            trend
                              ? [
                                  {
                                    id: `trend:${memberKey}`,
                                    seriesId: memberKey,
                                    from: {
                                      date: trend.startDate,
                                      value: chartValue(trend.startWeightKg),
                                    },
                                    to: {
                                      date: trend.endDate,
                                      value: chartValue(trend.endWeightKg),
                                    },
                                    color: memberColors.get(memberKey)!,
                                    title: `${series.find((member) => member.memberKey === memberKey)?.label ?? 'Member'} derived trend from displayed shared points`,
                                    kind: 'trend' as const,
                                  },
                                ]
                              : [],
                          ),
                        ]}
                      />
                      {!selectedKey &&
                      series.length > 0 &&
                      series.every((member) =>
                        hiddenMemberKeys.has(member.memberKey),
                      ) ? (
                        <p
                          role="status"
                          aria-label="Chart visibility status"
                          className="mt-2 text-center text-sm"
                        >
                          All participants are hidden. Select a participant in
                          the legend to show their chart.
                        </p>
                      ) : null}
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
                          Each member is plotted at their actual shared weight
                          in kilograms. Points represent shared dates; lines
                          connect only consecutive days. The Records tab
                          provides exact shared weights and labels estimates
                          between them.
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
                                    (item) =>
                                      item.memberKey === member.memberKey,
                                  )!.trend!.startDate,
                                )}
                                y1={y(
                                  chartValue(
                                    trends.find(
                                      (item) =>
                                        item.memberKey === member.memberKey,
                                    )!.trend!.startWeightKg,
                                  ),
                                )}
                                x2={x(
                                  trends.find(
                                    (item) =>
                                      item.memberKey === member.memberKey,
                                  )!.trend!.endDate,
                                )}
                                y2={y(
                                  chartValue(
                                    trends.find(
                                      (item) =>
                                        item.memberKey === member.memberKey,
                                    )!.trend!.endWeightKg,
                                  ),
                                )}
                                stroke={memberColors.get(member.memberKey)}
                                strokeWidth={2.5}
                                opacity={sharedChartTheme.trendOpacity}
                                strokeLinecap="round"
                              >
                                <title>
                                  {member.label} derived trend from displayed
                                  shared points
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
                                      {member.label}:{' '}
                                      {formatChartDate(point.date)},{' '}
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
                            new Date(start * 86400000)
                              .toISOString()
                              .slice(0, 10),
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
                      {series.map((member) => {
                        const isComparison = !selectedKey
                        const isHidden =
                          isComparison && hiddenMemberKeys.has(member.memberKey)
                        return (
                          <li
                            key={member.memberKey}
                            className="flex min-w-0 items-center gap-1"
                          >
                            {isComparison ? (
                              <button
                                type="button"
                                aria-label={`${member.label} chart series, currently ${isHidden ? 'hidden' : 'visible'}`}
                                aria-pressed={!isHidden}
                                onClick={() =>
                                  setHiddenMemberState((current) => {
                                    const memberKeys = new Set(
                                      current.context === context
                                        ? current.memberKeys
                                        : [],
                                    )
                                    if (memberKeys.has(member.memberKey))
                                      memberKeys.delete(member.memberKey)
                                    else memberKeys.add(member.memberKey)
                                    return { context, memberKeys }
                                  })
                                }
                                className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border-0 bg-transparent px-1 text-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 ${isHidden ? 'text-slate-500 line-through' : 'text-current'}`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`inline-block w-6 shrink-0 border-t-2 ${isHidden ? 'opacity-40' : ''}`}
                                  style={{
                                    borderColor: memberColors.get(
                                      member.memberKey,
                                    ),
                                  }}
                                />
                                <GroupParticipantAvatar
                                  avatarPresetId={
                                    avatarByMemberKey.get(member.memberKey)
                                      ?.avatarPresetId
                                  }
                                  displayName={member.label}
                                />
                                <span>{member.label}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 py-1 font-semibold">
                                <span
                                  aria-hidden="true"
                                  className="inline-block w-6 shrink-0 border-t-2"
                                  style={{
                                    borderColor: memberColors.get(
                                      member.memberKey,
                                    ),
                                  }}
                                />
                                <GroupParticipantAvatar
                                  avatarPresetId={
                                    avatarByMemberKey.get(member.memberKey)
                                      ?.avatarPresetId
                                  }
                                  displayName={member.label}
                                />
                                <span>{member.label}</span>
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : null}
                {showRecords ? (
                  <>
                    <div
                      role="region"
                      aria-label="Scrollable shared group weights"
                      tabIndex={0}
                      className="relative isolate mt-5 max-h-[28rem] overflow-auto rounded-xl border border-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"
                    >
                      <table
                        aria-label="Shared group weight history"
                        className="group-history-table table-fixed border-collapse text-left text-xs"
                        style={{
                          width: '100%',
                          minWidth: `max(100%, ${120 + series.length * (view === 'records' ? 259 : 236)}px)`,
                        }}
                      >
                        <colgroup>
                          <col style={{ width: 120 }} />
                          {series.map((member) => (
                            <col key={member.memberKey} />
                          ))}
                        </colgroup>
                        <caption className="p-3 text-left font-semibold">
                          Shared weights (kg). Dashed cards are estimates;
                          dashes mean no shared value is available.
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
                                className="sticky top-0 z-20 break-words bg-stone-50 px-1 py-2 text-center align-middle"
                              >
                                <button
                                  type="button"
                                  aria-label={`Show Records for ${member.label}`}
                                  aria-pressed={
                                    selectedKey === member.memberKey
                                  }
                                  className="inline-flex min-h-11 items-center justify-center rounded px-1 text-[0.875rem] font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                                  onClick={() =>
                                    setSelection({
                                      context,
                                      memberKey: member.memberKey,
                                    })
                                  }
                                >
                                  {member.label} (kg)
                                </button>
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
                                  data-record-cell={
                                    view === 'records' ? '' : undefined
                                  }
                                  className={`relative z-0 px-1 ${
                                    view === 'records' && point
                                      ? 'py-0.5'
                                      : 'py-1'
                                  }`}
                                >
                                  {point ? (
                                    point.estimated ? (
                                      <div
                                        data-record-estimate=""
                                        data-estimate-date={point.date}
                                        className="record-estimate relative flex min-h-[46px] min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-dashed border-slate-700 bg-slate-800 p-0.5 text-center"
                                      >
                                        <div
                                          data-record-estimate-value=""
                                          className="inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap"
                                        >
                                          <span className="text-[10px] font-semibold tracking-wide text-slate-400">
                                            Estimated
                                          </span>
                                          <WeightEntryCard
                                            weightKg={point.weightKg}
                                            className="record-estimate-weight !h-10 !min-w-0 !w-auto !justify-center !border-dashed !border-slate-700 !px-1 bg-slate-900"
                                            valueClassName="font-normal text-slate-100"
                                            valueSizeClassName="text-[11px]"
                                            valueFontScale={68}
                                          />
                                        </div>
                                        {point.memberKey === ownMemberKey &&
                                        personalWorkspace.userId ===
                                          viewerId.toLowerCase() &&
                                        personalWorkspace.persistence.mode ===
                                          'remote' &&
                                        personalWorkspace.personal.state ===
                                          'ready' &&
                                        personalWorkspace.contexts.state ===
                                          'ready' ? (
                                          <div
                                            data-record-actions=""
                                            className="flex shrink-0 justify-center"
                                          >
                                            <button
                                              type="button"
                                              aria-label={`Record estimated weight ${point.weightKg} kg on ${point.date} for ${series[index].label}`}
                                              className="min-h-8 whitespace-nowrap rounded-lg px-1 text-[10px] font-semibold text-forest-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 pointer-coarse:min-h-11"
                                              onClick={() =>
                                                setChartAction({
                                                  context,
                                                  date: point.date,
                                                  value: point.weightKg,
                                                  estimated: true,
                                                })
                                              }
                                            >
                                              Record weight
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div
                                        data-record-pair={
                                          view === 'records' ? '' : undefined
                                        }
                                        className={
                                          view === 'records'
                                            ? 'w-full rounded-xl border border-slate-700 bg-slate-800 p-0.5'
                                            : 'contents'
                                        }
                                      >
                                        <div
                                          data-record-pair-layout={
                                            view === 'records' ? '' : undefined
                                          }
                                          className={
                                            view === 'records'
                                              ? 'grid w-full grid-cols-[minmax(64px,0.7fr)_minmax(124px,2fr)] items-stretch gap-1 pointer-coarse:grid-cols-[minmax(64px,0.7fr)_minmax(148px,2fr)]'
                                              : 'contents'
                                          }
                                        >
                                          {view === 'records' ? (
                                            <div
                                              data-record-comparison
                                              className="flex min-h-10 min-w-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-1 text-center text-[11.5px] pointer-coarse:min-h-11"
                                            >
                                              <span
                                                className={`whitespace-nowrap ${sharedChangeColor(point.previousSharedChangeKg, true)}`}
                                              >
                                                {point.previousSharedChangeKg ===
                                                null
                                                  ? '—'
                                                  : signed(
                                                      point.previousSharedChangeKg,
                                                    )}
                                              </span>
                                            </div>
                                          ) : null}
                                          <WeightEntryCard
                                            weightKg={point.weightKg}
                                            centerValue={view === 'records'}
                                            className={
                                              view === 'records'
                                                ? 'record-weight-box !w-full !justify-center !border-solid !border-slate-700 min-w-[124px] bg-slate-900 pointer-coarse:min-w-[148px]'
                                                : undefined
                                            }
                                            valueClassName={
                                              view === 'records'
                                                ? `font-bold ${sharedChangeColor(
                                                    point.previousSharedChangeKg,
                                                    true,
                                                  )}`
                                                : undefined
                                            }
                                            valueSizeClassName={
                                              view === 'records'
                                                ? 'text-[18px]'
                                                : undefined
                                            }
                                            valueFontScale={
                                              view === 'records'
                                                ? 126
                                                : undefined
                                            }
                                          >
                                            <span className="sr-only">
                                              ; change from first shared entry{' '}
                                              {signed(point.changeKg)}
                                            </span>
                                            {point.memberKey === ownMemberKey &&
                                            personalWorkspace.userId ===
                                              viewerId.toLowerCase() &&
                                            personalWorkspace.persistence
                                              .mode === 'remote' &&
                                            personalWorkspace.personal.state ===
                                              'ready' &&
                                            personalWorkspace.contexts.state ===
                                              'ready' ? (
                                              <WeightEntryActions
                                                key={`${personalWorkspace.ownerKey}:${challengeId}:${point.date}`}
                                                workspace={personalWorkspace}
                                                date={point.date}
                                                compact
                                                memberLabel={
                                                  series[index].label
                                                }
                                                recordsDeleteIcon
                                                requiredSharedChallengeId={
                                                  challengeId
                                                }
                                              />
                                            ) : null}
                                          </WeightEntryCard>
                                        </div>
                                      </div>
                                    )
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
                    {recordPage.pageCount > 1 ? (
                      <nav
                        aria-label="Shared group weight history pages"
                        className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <button
                          type="button"
                          disabled={recordPage.pageIndex === 0}
                          onClick={() =>
                            setRecordPageIndex(recordPage.pageIndex - 1)
                          }
                          className="min-h-11 rounded-lg border border-line px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Newer dates
                        </button>
                        <span aria-live="polite" className="text-ink-muted">
                          Dates {recordPage.firstPosition}–
                          {recordPage.lastPosition} of {recordPage.totalDates}
                          {' · '}newest first
                        </span>
                        <button
                          type="button"
                          disabled={
                            recordPage.pageIndex >= recordPage.pageCount - 1
                          }
                          onClick={() =>
                            setRecordPageIndex(recordPage.pageIndex + 1)
                          }
                          className="min-h-11 rounded-lg border border-line px-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Older dates
                        </button>
                      </nav>
                    ) : null}
                  </>
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

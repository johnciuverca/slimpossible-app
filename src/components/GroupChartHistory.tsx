import { useEffect, useState } from 'react'
import type { Persistence } from '../data/persistence'
import {
  createGroupChartHistory,
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
}: {
  challengeId: string
  viewerId: string
  persistence: Persistence
  refreshVersion: number
}) {
  const key = `${viewerId}:${challengeId}:${refreshVersion}:${persistence.mode}`
  const [snapshot, setSnapshot] = useState<{
    key: string
    state: 'success' | 'error'
    entries: GroupChartEntry[]
  } | null>(null)
  useEffect(() => {
    let current = true
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
  }, [challengeId, persistence, key])
  const data = snapshot?.key === key ? snapshot : null
  const series = createGroupChartHistory(data?.entries ?? [], localDateOnly())
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
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Explicitly shared dates and weights only. Change is measured in kg from
        each member’s first shared entry, not their private starting weight.
        Negative means loss; positive means gain. This chart is not a winner
        ranking. Notes and emails are never included.
      </p>
      {!data ? (
        <p role="status" className="mt-4">
          Loading shared group history…
        </p>
      ) : data.state === 'error' ? (
        <p role="status" className="mt-4 text-red-800">
          Shared group history is unavailable. Refresh shared progress to retry.
        </p>
      ) : series.length === 0 ? (
        <p className="mt-4">No entries have been shared with this group.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-700">
            Missing dates are gaps, not estimated weights. A single shared entry
            establishes a zero-change baseline. Late entries, corrections and
            removed shares recalculate the baseline on refresh.
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
                Each member has their own zero baseline. Points represent shared
                recorded dates. Lines connect only consecutive days. The table
                below provides every date, exact weight and kg change.
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
                  <text x={60} y={y(value) + 4} textAnchor="end" fontSize={12}>
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
                            strokeDasharray={index % 2 ? '5 3' : undefined}
                          />
                        ) : null}
                        <circle cx={x(point.date)} cy={y(point.changeKg)} r={4}>
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
            className="mt-5 overflow-x-auto rounded-xl border border-stone-200 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <table
              aria-label="Shared group weight history"
              className="w-full min-w-[36rem] border-collapse text-left text-sm"
            >
              <caption className="p-3 text-left font-semibold">
                Exact shared weights and change from each member’s first shared
                entry
              </caption>
              <thead className="bg-stone-50">
                <tr>
                  {[
                    'Member',
                    'Recorded date',
                    'Weight (kg)',
                    'Change from baseline (kg)',
                  ].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {series
                  .flatMap((member) =>
                    member.points.map((point) => ({
                      ...point,
                      label: member.label,
                    })),
                  )
                  .sort(
                    (a, b) =>
                      b.date.localeCompare(a.date) ||
                      a.label.localeCompare(b.label),
                  )
                  .map((point) => (
                    <tr key={`${point.memberKey}:${point.date}`}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        {point.label}
                      </th>
                      <td className="px-4 py-3">
                        <time dateTime={point.date}>{point.date}</time>
                      </td>
                      <td className="px-4 py-3">{point.weightKg} kg</td>
                      <td className="px-4 py-3">{signed(point.changeKg)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

import type { WeighIn } from '../models/weighIn'

const chartWidth = 720
const chartHeight = 220
const left = 42
const right = 700
const top = 24
const bottom = 174

function formatWeight(weightKg: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(weightKg)
}

export function PersonalProgressChart({
  weighIns,
}: {
  weighIns: readonly WeighIn[]
}) {
  const chronological = [...weighIns].reverse()
  const first = chronological[0]
  const latest = chronological.at(-1)

  if (!first || !latest) return null

  const firstDay = Date.parse(`${first.date}T00:00:00.000Z`)
  const latestDay = Date.parse(`${latest.date}T00:00:00.000Z`)
  const daySpan = latestDay - firstDay
  const weights = chronological.map(({ weightKg }) => weightKg)
  const minWeight = Math.min(...weights)
  const weightSpan = Math.max(...weights) - minWeight || 1
  const points = chronological.map((weighIn, index) => {
    const day = Date.parse(`${weighIn.date}T00:00:00.000Z`)
    return {
      date: weighIn.date,
      weightKg: weighIn.weightKg,
      x:
        daySpan === 0
          ? (left + right) / 2
          : left + ((day - firstDay) / daySpan) * (right - left),
      y:
        bottom - ((weighIn.weightKg - minWeight) / weightSpan) * (bottom - top),
      key: `${weighIn.participantId}-${weighIn.date}-${index}`,
    }
  })
  const line = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
  const rangeDescription =
    first.date === latest.date
      ? `${first.date}, ${formatWeight(first.weightKg)} kilograms`
      : `${first.date}, ${formatWeight(first.weightKg)} kilograms to ${latest.date}, ${formatWeight(latest.weightKg)} kilograms`

  return (
    <figure className="mt-5" aria-labelledby="personal-history-caption">
      <svg
        aria-describedby="personal-history-description"
        aria-label={`Personal weight history chart. ${points.length} saved weigh-ins, from ${rangeDescription}. Each point is a saved entry; no values are estimated.`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <title>Personal saved weigh-ins</title>
        <desc id="personal-history-description">
          The plotted points use saved weigh-in dates and weights only. Exact
          dates, weights, changes, and private notes are in the table below.
        </desc>
        {[top, (top + bottom) / 2, bottom].map((y) => (
          <line
            key={y}
            stroke="#d9e4dc"
            strokeDasharray="3 6"
            strokeWidth="1"
            x1={left}
            x2={right}
            y1={y}
            y2={y}
          />
        ))}
        {points.length > 1 ? (
          <path
            d={line}
            fill="none"
            stroke="#087756"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {points.map(({ date, key, weightKg, x, y }) => (
          <circle
            cx={x}
            cy={y}
            data-date={date}
            data-weight-kg={weightKg}
            fill="#087756"
            key={key}
            r="6"
            stroke="white"
            strokeWidth="3"
          />
        ))}
        {first.date === latest.date ? (
          <text
            fill="#52645a"
            fontSize="14"
            textAnchor="middle"
            x={(left + right) / 2}
            y="207"
          >
            {first.date}
          </text>
        ) : (
          <>
            <text fill="#52645a" fontSize="14" x={left} y="207">
              {first.date}
            </text>
            <text
              fill="#52645a"
              fontSize="14"
              textAnchor="end"
              x={right}
              y="207"
            >
              {latest.date}
            </text>
          </>
        )}
      </svg>
      <figcaption
        className="mt-3 text-sm leading-6 text-slate-600"
        id="personal-history-caption"
      >
        {points.length === 1
          ? 'One saved weigh-in is shown. Add another entry to compare your trend.'
          : `${points.length} saved weigh-ins from ${first.date} to ${latest.date}. No missing weights are estimated.`}
      </figcaption>
    </figure>
  )
}

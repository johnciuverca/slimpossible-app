import { Link } from 'react-router-dom'

const gearRotations = Array.from({ length: 8 }, (_, index) => index * 45)

type GearWheelProps = {
  centerX: number
  centerY: number
  hubRadius: number
  toothWidth: number
  toothY: number
  toothHeight: number
  toothRadius: number
  centerHoleRadius: number
}

function GearWheel({
  centerX,
  centerY,
  hubRadius,
  toothWidth,
  toothY,
  toothHeight,
  toothRadius,
  centerHoleRadius,
}: GearWheelProps) {
  return (
    <g transform={`translate(${centerX} ${centerY})`}>
      <circle r={hubRadius} />
      <g>
        {gearRotations.map((rotation) => (
          <rect
            key={rotation}
            x={-toothWidth / 2}
            y={toothY}
            width={toothWidth}
            height={toothHeight}
            rx={toothRadius}
            transform={`rotate(${rotation})`}
          />
        ))}
      </g>
      <circle r={centerHoleRadius} fill="var(--group-accent-strong, #145447)" />
    </g>
  )
}

/** Render only for the selected group's verified owner. */
export function ChallengeSettingsLink() {
  return (
    <Link
      to="/challenge/manage"
      className="challenge-settings-link"
      aria-label="Manage challenges"
      title="Manage challenges"
    >
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 28 28"
        fill="currentColor"
      >
        <g transform="translate(1 1)">
          <GearWheel
            centerX={9}
            centerY={9}
            hubRadius={5.25}
            toothWidth={3}
            toothY={-9}
            toothHeight={4.4}
            toothRadius={0.7}
            centerHoleRadius={2.4}
          />
          <GearWheel
            centerX={19.5}
            centerY={18.5}
            hubRadius={3.3}
            toothWidth={2.3}
            toothY={-6.4}
            toothHeight={3.2}
            toothRadius={0.55}
            centerHoleRadius={1.45}
          />
        </g>
      </svg>
    </Link>
  )
}

import { Link } from 'react-router-dom'

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
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.02 9.85 22.21 10.02 22.21 13.98 20.02 14.15 19.19 16.15 20.62 17.82 17.82 20.62 16.15 19.19 14.15 20.02 13.98 22.21 10.02 22.21 9.85 20.02 7.85 19.19 6.18 20.62 3.38 17.82 4.81 16.15 3.98 14.15 1.79 13.98 1.79 10.02 3.98 9.85 4.81 7.85 3.38 6.18 6.18 3.38 7.85 4.81 9.85 3.98 10.02 1.79 13.98 1.79 14.15 3.98 16.15 4.81 17.82 3.38 20.62 6.18 19.19 7.85Z" />
        <circle cx="12" cy="12" r="3.25" />
      </svg>
    </Link>
  )
}

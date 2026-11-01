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
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      >
        <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </Link>
  )
}

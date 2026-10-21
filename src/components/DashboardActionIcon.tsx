export function DashboardActionIcon({
  kind,
}: {
  kind: 'record' | 'create' | 'invite' | 'join'
}) {
  return (
    <span className="dashboard-action-icon" aria-hidden="true">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'record' ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8m-4-4h8" />
          </>
        ) : kind === 'create' ? (
          <>
            <path d="M8 3h8v5a4 4 0 0 1-8 0V3zm4 9v7m-4 2h8M8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4" />
          </>
        ) : kind === 'invite' ? (
          <>
            <circle cx="9" cy="7" r="3" />
            <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 5" />
          </>
        ) : (
          <>
            <path d="m9 15 6-6m-7 4-2 2a4 4 0 0 0 6 6l3-3m-4-7 2-2a4 4 0 0 1 6 6l-3 3" />
          </>
        )}
      </svg>
    </span>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Button, Card } from './ui'

const actionClass =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700'

export function DashboardChallengeActions({
  workspace,
}: {
  workspace: PersonalWorkspace
}) {
  // Remount owner-specific chooser state immediately when the account changes.
  return <OwnedGroupActions key={workspace.ownerKey} workspace={workspace} />
}

function OwnedGroupActions({ workspace }: { workspace: PersonalWorkspace }) {
  const [choosing, setChoosing] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const { contexts } = workspace
  const groups =
    contexts.state === 'ready'
      ? contexts.data.challenges.filter(
          ({ kind, ownerId, status }) =>
            kind === 'group' &&
            ownerId === workspace.userId &&
            (status === 'draft' || status === 'active'),
        )
      : []
  const selected = groups.find(({ id }) => id === selectedId)
  const inviteDestination = (id: string) =>
    `/challenge/invites?${new URLSearchParams({ challenge: id })}`
  return (
    <Card
      className="space-y-4 p-6"
      role="region"
      aria-labelledby="dashboard-connect-title"
    >
      <h2 id="dashboard-connect-title" className="text-lg font-bold">
        Create and connect
      </h2>
      <p className="text-sm text-ink-muted">
        Challenges are optional. Create one or invite people to a group you own.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className={actionClass} to="/challenge/setup">
          Create challenge
        </Link>
        {groups.length === 1 ? (
          <Link className={actionClass} to={inviteDestination(groups[0].id)}>
            Invite people
          </Link>
        ) : (
          <Button
            variant="secondary"
            disabled={contexts.state !== 'ready'}
            aria-expanded={choosing}
            aria-controls="dashboard-invite-chooser"
            onClick={() => setChoosing((value) => !value)}
          >
            Invite people
          </Button>
        )}
      </div>
      {contexts.state === 'loading' ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading your invitation choices…
        </p>
      ) : contexts.state === 'error' ? (
        <p role="status" className="text-sm text-ink-muted">
          Invitation choices could not be loaded. Refresh Dashboard to try
          again; personal recording is still available.
        </p>
      ) : choosing && groups.length !== 1 ? (
        <div
          id="dashboard-invite-chooser"
          className="space-y-3 rounded-xl border border-line p-4"
        >
          {groups.length === 0 ? (
            <p role="status" className="text-sm text-ink-muted">
              Create a group challenge first to invite people. You can keep
              recording privately without one.
            </p>
          ) : (
            <>
              <label
                htmlFor="dashboard-invite-group"
                className="block text-sm font-semibold"
              >
                Choose a group you own
              </label>
              <select
                id="dashboard-invite-group"
                className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 py-2"
                value={selected?.id ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">Choose a group</option>
                {groups.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              {selected ? (
                <Link
                  className={actionClass}
                  to={inviteDestination(selected.id)}
                >
                  Continue to invitations
                </Link>
              ) : (
                <p className="text-sm text-ink-muted">
                  Select a group to continue. No invitation is created here.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </Card>
  )
}

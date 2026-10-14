import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { Button, Card } from './ui'
import { DashboardActionIcon } from './DashboardActionIcon'

const actionClass =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700'

export function DashboardChallengeActions({
  workspace,
  recordAction,
}: {
  workspace: PersonalWorkspace
  recordAction?: ReactNode
}) {
  // Remount owner-specific chooser state immediately when the account changes.
  return (
    <OwnedGroupActions
      key={workspace.ownerKey}
      workspace={workspace}
      recordAction={recordAction}
    />
  )
}

function OwnedGroupActions({
  workspace,
  recordAction,
}: {
  workspace: PersonalWorkspace
  recordAction?: ReactNode
}) {
  const navigate = useNavigate()
  const [joining, setJoining] = useState(false)
  const [invitation, setInvitation] = useState('')
  const [joinError, setJoinError] = useState('')
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
      className={
        recordAction ? 'dashboard-actions-region space-y-4' : 'space-y-4 p-6'
      }
      role="region"
      aria-labelledby="dashboard-connect-title"
    >
      <h2
        id="dashboard-connect-title"
        className={recordAction ? 'sr-only' : 'text-lg font-bold'}
      >
        Create and connect
      </h2>
      <p className={recordAction ? 'sr-only' : 'text-sm text-ink-muted'}>
        Challenges are optional. Create one or invite people to a group you own.
      </p>
      <div
        className={
          recordAction ? 'dashboard-action-grid' : 'flex flex-wrap gap-3'
        }
      >
        {recordAction}
        <Link
          aria-label="Create challenge"
          className={
            recordAction
              ? 'dashboard-action dashboard-action-create'
              : actionClass
          }
          to="/challenge/setup"
        >
          {recordAction ? <DashboardActionIcon kind="create" /> : null}
          <span>
            Create challenge
            {recordAction ? (
              <span className="dashboard-action-description">
                Start a new challenge
              </span>
            ) : null}
          </span>
          {recordAction ? (
            <span className="dashboard-action-chevron" aria-hidden="true">
              ›
            </span>
          ) : null}
        </Link>
        {groups.length === 1 ? (
          <Link
            aria-label="Invite people"
            className={
              recordAction
                ? 'dashboard-action dashboard-action-invite'
                : actionClass
            }
            to={inviteDestination(groups[0].id)}
          >
            {recordAction ? <DashboardActionIcon kind="invite" /> : null}
            <span>
              Invite people
              {recordAction ? (
                <span className="dashboard-action-description">
                  Bring your group together
                </span>
              ) : null}
            </span>
            {recordAction ? (
              <span className="dashboard-action-chevron" aria-hidden="true">
                ›
              </span>
            ) : null}
          </Link>
        ) : (
          <Button
            aria-label="Invite people"
            className={
              recordAction ? 'dashboard-action dashboard-action-invite' : ''
            }
            variant="secondary"
            disabled={contexts.state !== 'ready'}
            aria-expanded={choosing}
            aria-controls="dashboard-invite-chooser"
            onClick={() => setChoosing((value) => !value)}
          >
            {recordAction ? <DashboardActionIcon kind="invite" /> : null}
            <span>
              Invite people
              {recordAction ? (
                <span className="dashboard-action-description">
                  Bring your group together
                </span>
              ) : null}
            </span>
            {recordAction ? (
              <span className="dashboard-action-chevron" aria-hidden="true">
                ›
              </span>
            ) : null}
          </Button>
        )}
        <Button
          aria-label="Join with invitation"
          className={
            recordAction ? 'dashboard-action dashboard-action-join' : 'min-h-11'
          }
          variant="secondary"
          aria-expanded={joining}
          aria-controls="dashboard-join"
          onClick={() => setJoining((value) => !value)}
        >
          {recordAction ? <DashboardActionIcon kind="join" /> : null}
          <span>
            Join with invitation
            {recordAction ? (
              <span className="dashboard-action-description">
                Use an invitation link
              </span>
            ) : null}
          </span>
          {recordAction ? (
            <span className="dashboard-action-chevron" aria-hidden="true">
              ›
            </span>
          ) : null}
        </Button>
      </div>
      {joining ? (
        <form
          id="dashboard-join"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            const value = invitation.trim()
            const match = value.match(/(?:^|\/)invite\/([^/?#]+)/)
            const token =
              match?.[1] ?? (/^[a-zA-Z0-9_-]+$/.test(value) ? value : '')
            if (!token) {
              setJoinError('Paste the invitation link or token you received.')
              return
            }
            navigate(`/invite/${encodeURIComponent(token)}`)
          }}
        >
          <label
            htmlFor="dashboard-invitation"
            className="block text-sm font-semibold"
          >
            Invitation link or token
          </label>
          <input
            id="dashboard-invitation"
            className="min-h-11 w-full rounded-xl border border-line bg-panel px-3 py-2"
            value={invitation}
            onChange={(event) => {
              setInvitation(event.target.value)
              setJoinError('')
            }}
          />
          {joinError ? <p role="alert">{joinError}</p> : null}
          <Button className="min-h-11" type="submit">
            Review invitation
          </Button>
        </form>
      ) : null}
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

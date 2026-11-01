import { useEffect, useState, type ReactNode } from 'react'
import {
  usePersonalWorkspace,
  type PersonalWorkspace,
} from '../data/usePersonalWorkspace'
import { personalWeighInToday } from '../models/personalWeighIn'
import { RecordWeightDialog } from './RecordWeightDialog'
import { Button } from './ui'
import { DashboardActionIcon } from './DashboardActionIcon'

/** One responsive action position for all personal and challenge pages. */
export function WeightPageHeader({
  children,
  action,
  onRecorded,
  additionalActions,
}: {
  children: ReactNode
  action?: ReactNode
  onRecorded?: () => void
  additionalActions?: ReactNode
}) {
  const recordAction = action ?? (
    <StandaloneRecordWeightAction onRecorded={onRecorded} />
  )
  return (
    <header
      className={
        additionalActions
          ? 'flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'
          : 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'
      }
      data-weight-page-header
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div
        className={
          additionalActions
            ? 'flex max-w-full flex-wrap items-start gap-2 self-start'
            : 'shrink-0 self-start'
        }
        role={additionalActions ? 'group' : undefined}
        aria-label={additionalActions ? 'Group actions' : undefined}
      >
        {additionalActions ? (
          <div className="min-w-0 [&>button]:min-h-11">{recordAction}</div>
        ) : (
          recordAction
        )}
        {additionalActions}
      </div>
    </header>
  )
}

function StandaloneRecordWeightAction({
  onRecorded,
}: {
  onRecorded?: () => void
}) {
  const workspace = usePersonalWorkspace()
  return <RecordWeightAction workspace={workspace} onRecorded={onRecorded} />
}

export function RecordWeightAction({
  workspace,
  onRecorded,
  presentation = 'button',
  showSavedFeedback = true,
  onOpen,
}: {
  workspace: PersonalWorkspace
  onRecorded?: () => void
  presentation?: 'button' | 'card'
  showSavedFeedback?: boolean
  onOpen?: () => void
}) {
  const [openOwner, setOpenOwner] = useState<string | null>(null)
  const [savedOwner, setSavedOwner] = useState<string | null>(null)
  useEffect(() => {
    setOpenOwner(null)
    setSavedOwner(null)
  }, [workspace.ownerKey])
  const entry = workspace.personal.data.find(
    ({ date }) => date === personalWeighInToday(),
  )
  return (
    <>
      <Button
        aria-label={presentation === 'card' ? 'Record weight' : undefined}
        className={
          presentation === 'card'
            ? 'dashboard-action dashboard-action-record'
            : ''
        }
        data-weight-owner={workspace.ownerKey}
        disabled={workspace.personal.state !== 'ready'}
        onClick={() => {
          onOpen?.()
          setOpenOwner(workspace.ownerKey)
        }}
      >
        {presentation === 'card' ? (
          <>
            <DashboardActionIcon kind="record" />
            <span>
              <span className="block">Record weight</span>
              <span className="dashboard-action-description">
                Log your latest weight
              </span>
            </span>
            <span className="dashboard-action-chevron" aria-hidden="true">
              ›
            </span>
          </>
        ) : (
          'Record weight'
        )}
      </Button>
      {workspace.personal.error ? (
        <p role="status" className="mt-2 max-w-xs text-sm text-ink-muted">
          {workspace.personal.error}
        </p>
      ) : null}
      {showSavedFeedback && savedOwner === workspace.ownerKey ? (
        <p role="status" className="mt-2 text-sm text-forest-800">
          Personal weight saved.
        </p>
      ) : null}
      {openOwner === workspace.ownerKey ? (
        <RecordWeightDialog
          key={workspace.ownerKey}
          workspace={workspace}
          entry={entry}
          onClose={() => setOpenOwner(null)}
          onSaved={() => {
            setOpenOwner(null)
            setSavedOwner(workspace.ownerKey)
            workspace.refresh()
            onRecorded?.()
          }}
        />
      ) : null}
    </>
  )
}

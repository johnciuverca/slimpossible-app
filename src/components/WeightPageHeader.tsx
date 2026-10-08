import { useEffect, useState, type ReactNode } from 'react'
import {
  usePersonalWorkspace,
  type PersonalWorkspace,
} from '../data/usePersonalWorkspace'
import { personalWeighInToday } from '../models/personalWeighIn'
import { RecordWeightDialog } from './RecordWeightDialog'
import { Button } from './ui'

/** One responsive action position for all personal and challenge pages. */
export function WeightPageHeader({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <header
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      data-weight-page-header
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div className="shrink-0 self-start">
        {action ?? <StandaloneRecordWeightAction />}
      </div>
    </header>
  )
}

function StandaloneRecordWeightAction() {
  const workspace = usePersonalWorkspace()
  return <RecordWeightAction workspace={workspace} />
}

export function RecordWeightAction({
  workspace,
}: {
  workspace: PersonalWorkspace
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
        disabled={workspace.personal.state !== 'ready'}
        onClick={() => setOpenOwner(workspace.ownerKey)}
      >
        Record weight
      </Button>
      {workspace.personal.error ? (
        <p role="status" className="mt-2 max-w-xs text-sm text-ink-muted">
          {workspace.personal.error}
        </p>
      ) : null}
      {savedOwner === workspace.ownerKey ? (
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
          }}
        />
      ) : null}
    </>
  )
}

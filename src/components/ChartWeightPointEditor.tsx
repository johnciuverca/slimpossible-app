import type { PersonalWorkspace } from '../data/usePersonalWorkspace'
import { RecordWeightDialog } from './RecordWeightDialog'

export type ChartWeightPointSelection = {
  date: string
  value: number
  estimated: boolean
}

type ChartWeightPointEditorProps = {
  onClose: () => void
  onDuplicateDate?: (date: string) => void
  onSaved: () => void
  point: ChartWeightPointSelection | null
  requiredSharedChallengeId?: string
  scopeKey?: string
  workspace: PersonalWorkspace
}

/** Resolves a selected chart date only after personal data and share choices load. */
export function ChartWeightPointEditor({
  onClose,
  onDuplicateDate,
  onSaved,
  point,
  requiredSharedChallengeId,
  scopeKey = 'personal-chart',
  workspace,
}: ChartWeightPointEditorProps) {
  if (
    !point ||
    workspace.personal.state !== 'ready' ||
    workspace.contexts.state !== 'ready'
  )
    return null

  const entry = workspace.personal.data.find(
    (item) =>
      item.date === point.date &&
      (point.estimated ||
        !requiredSharedChallengeId ||
        item.sharedChallengeIds.includes(requiredSharedChallengeId)),
  )
  if (!entry && !point.estimated) return null

  const groupEstimate = Boolean(point.estimated && requiredSharedChallengeId)
  const estimateNotice = point.estimated
    ? requiredSharedChallengeId
      ? entry
        ? 'This estimated Group chart date matches a saved personal entry.'
        : 'This Group chart value is a display-only estimate.'
      : entry
        ? 'This estimated chart date matches a saved personal entry.'
        : 'This is a display-only estimate.'
    : undefined

  return (
    <RecordWeightDialog
      key={`${scopeKey}:${point.date}:${entry?.id ?? 'new'}`}
      workspace={workspace}
      entry={entry}
      preselectSharedChallengeId={
        groupEstimate ? requiredSharedChallengeId : undefined
      }
      initialValues={
        entry ? undefined : { date: point.date, weightKg: String(point.value) }
      }
      estimateNotice={estimateNotice}
      onClose={onClose}
      onSaved={onSaved}
      onDuplicateDate={onDuplicateDate}
    />
  )
}

export type GroupMemberProgress = {
  completionPercentage: number | null
  displayName: string
  memberKey: string
  progressState: 'unavailable' | 'in_progress' | 'reached'
  reachedTargetMilestones: Array<{
    achievedOn: string
    state: 'reached'
    targetWeightKg: number
  }>
  startingWeightKg: number | null
  targetWeightKg: number | null
}

export type GroupMemberProgressSnapshot = {
  key: string
  rows: GroupMemberProgress[]
  state: 'loading' | 'ready' | 'error'
}

export function groupMemberProgressForKey(
  snapshot: GroupMemberProgressSnapshot,
  currentKey: string,
): GroupMemberProgressSnapshot {
  return snapshot.key === currentKey
    ? snapshot
    : { key: currentKey, rows: [], state: 'loading' }
}

export function valueForContext<T>(
  snapshot: { contextKey: string; value: T } | null,
  currentKey: string,
  authorized: boolean,
): T | null {
  return snapshot?.contextKey === currentKey && authorized
    ? snapshot.value
    : null
}

export function progressBlocks(percentage: number | null) {
  if (percentage === null || !Number.isFinite(percentage)) return 0
  return Math.round((Math.max(0, Math.min(100, percentage)) / 100) * 10)
}

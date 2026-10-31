export type GroupMemberProgress = {
  completionPercentage: number | null
  displayName: string
  memberKey: string
  negativeProgressCapped: boolean
  progressState: 'unavailable' | 'in_progress' | 'reached'
  reachedTargetMilestones: Array<{
    achievedOn: string
    state: 'reached'
    targetWeightKg: number
  }>
  signedDisplayPercentage: number | null
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

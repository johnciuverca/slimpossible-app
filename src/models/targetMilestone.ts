export type ReachedTargetMilestone = {
  achievedOn: string | null
  state: 'reached'
  targetWeightKg: number
}

export type GroupReachedTargetMilestone = ReachedTargetMilestone & {
  achievedOn: string
  displayName: string
  memberKey: string
}

export type OwnGroupTargetChange = {
  challengeId: string
  previousTargetMilestone: ReachedTargetMilestone | null
  startingWeightKg: number
  targetWeightKg: number
}

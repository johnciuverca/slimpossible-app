import type { ParticipantMilestones } from './participantMilestones'
import { milestoneThresholds } from './participantMilestones'
import type { SavedWeeklyWinCelebration } from './weeklyCelebrations'

export type CelebrationStorage = Pick<Storage, 'getItem' | 'setItem'>

type WeeklyResultRecord = {
  hasResult: boolean
  signature: string
}

function browserStorage(): CelebrationStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function encoded(value: string) {
  return encodeURIComponent(value)
}

function milestoneStorageKey(
  viewerId: string,
  milestones: ParticipantMilestones,
) {
  return [
    'slimpossible',
    'progress-celebrations',
    'v1',
    'milestones',
    encoded(viewerId),
    encoded(milestones.challengeId),
    encoded(milestones.participantId ?? 'unavailable'),
  ].join(':')
}

function validReachedThresholds(value: unknown): number[] | null {
  if (
    !Array.isArray(value) ||
    value.some(
      (threshold) =>
        !milestoneThresholds.includes(
          threshold as (typeof milestoneThresholds)[number],
        ),
    )
  ) {
    return null
  }

  return [...new Set(value as number[])].sort((first, second) => first - second)
}

function milestoneAnnouncement(
  newlyReached: readonly number[],
  noLongerReached: readonly number[],
) {
  const messages: string[] = []
  if (newlyReached.length > 0) {
    messages.push(
      `Milestone reached: ${newlyReached.join('%, ')}% of your goal.`,
    )
  }
  if (noLongerReached.length > 0) {
    messages.push(
      `Saved progress changed; the ${noLongerReached.join('%, ')}% milestone${noLongerReached.length === 1 ? ' is' : 's are'} no longer reached.`,
    )
  }
  return messages.join(' ')
}

export function reconcileMilestoneCelebration(
  viewerId: string,
  milestones: ParticipantMilestones,
  storage: CelebrationStorage | null = browserStorage(),
): string {
  if (
    !viewerId ||
    !storage ||
    milestones.state !== 'available' ||
    !Number.isFinite(milestones.completionPercentage)
  ) {
    return ''
  }

  const current = validReachedThresholds(
    milestones.milestones
      .filter(({ state }) => state === 'reached')
      .map(({ thresholdPercentage }) => thresholdPercentage),
  )
  if (!current) return ''

  const key = milestoneStorageKey(viewerId, milestones)
  try {
    const stored = storage.getItem(key)
    if (stored === null) {
      storage.setItem(key, JSON.stringify(current))
      return ''
    }

    let previous: number[] | null = null
    try {
      previous = validReachedThresholds(JSON.parse(stored))
    } catch {
      previous = null
    }
    if (previous === null) {
      storage.setItem(key, JSON.stringify(current))
      return ''
    }

    const newlyReached = current.filter(
      (threshold) => !previous!.includes(threshold),
    )
    const noLongerReached = previous.filter(
      (threshold) => !current.includes(threshold),
    )
    storage.setItem(key, JSON.stringify(current))
    return milestoneAnnouncement(newlyReached, noLongerReached)
  } catch {
    // Do not announce if deduplication cannot be persisted safely.
    return ''
  }
}

function resultSignature(celebration: SavedWeeklyWinCelebration) {
  const payload = JSON.stringify({
    eligibleParticipantCount: celebration.eligibleParticipantCount,
    state: celebration.state,
    winnerNames: [...celebration.winnerNames].sort(),
  })
  let hash = 0x811c9dc5
  for (let index = 0; index < payload.length; index += 1) {
    hash = Math.imul(hash ^ payload.charCodeAt(index), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function parseWeeklyResult(value: string): WeeklyResultRecord | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'hasResult' in parsed &&
      typeof parsed.hasResult === 'boolean' &&
      'signature' in parsed &&
      typeof parsed.signature === 'string'
    ) {
      return { hasResult: parsed.hasResult, signature: parsed.signature }
    }
  } catch {
    // Invalid or old storage is replaced with the current result as a baseline.
  }
  return null
}

function weeklyStorageKey(
  viewerId: string,
  celebration: SavedWeeklyWinCelebration,
) {
  return [
    'slimpossible',
    'progress-celebrations',
    'v1',
    'weekly',
    encoded(viewerId),
    encoded(celebration.challengeId),
    celebration.currentSunday,
  ].join(':')
}

export function reconcileWeeklyWinCelebration(
  viewerId: string,
  celebration: SavedWeeklyWinCelebration,
  storage: CelebrationStorage | null = browserStorage(),
): string {
  if (!viewerId || !storage) return ''

  const current: WeeklyResultRecord = {
    hasResult: celebration.state !== 'no-eligible-candidates',
    signature: resultSignature(celebration),
  }
  const key = weeklyStorageKey(viewerId, celebration)

  try {
    const stored = storage.getItem(key)
    if (stored === null) {
      storage.setItem(key, JSON.stringify(current))
      return ''
    }

    const previous = parseWeeklyResult(stored)
    if (!previous) {
      storage.setItem(key, JSON.stringify(current))
      return ''
    }

    storage.setItem(key, JSON.stringify(current))
    if (
      previous.hasResult === current.hasResult &&
      previous.signature === current.signature
    ) {
      return ''
    }
    if (!previous.hasResult && current.hasResult) {
      return `Weekly result posted: ${celebration.winnerNames.join(', ')}.`
    }
    if (current.hasResult) {
      return `Weekly result updated: ${celebration.winnerNames.join(', ')}.`
    }
    return 'Weekly result updated. No winner is currently eligible for these Sundays.'
  } catch {
    // Keep the visible saved result, but suppress an announcement without a ledger.
    return ''
  }
}

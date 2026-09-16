import type { ParticipantHistoryTrend } from './participantHistoryTrend'

export type ParticipantFeaturePlaceholder = {
  message: string
  state: 'no-records' | 'rules-required'
  value: null
}

export type ParticipantFeaturePlaceholders = {
  latestRecordDate: string | null
  recordCount: number
  streak: ParticipantFeaturePlaceholder
  weeklyWin: ParticipantFeaturePlaceholder
}

function noRecordsPlaceholder(feature: 'streak' | 'weekly-win') {
  if (feature === 'streak') {
    return {
      message: 'Record a weigh-in before future streak tracking can begin.',
      state: 'no-records' as const,
      value: null,
    }
  }

  return {
    message: 'Record a weigh-in before weekly wins can be assessed.',
    state: 'no-records' as const,
    value: null,
  }
}

function rulesRequiredPlaceholder(
  feature: 'streak' | 'weekly-win',
  recordCount: number,
) {
  const recordDescription =
    recordCount === 1
      ? '1 recorded weigh-in is'
      : `${recordCount} recorded weigh-ins are`

  if (feature === 'streak') {
    return {
      message: `${recordDescription} available, but a streak needs an explicit calendar continuity rule.`,
      state: 'rules-required' as const,
      value: null,
    }
  }

  return {
    message: `${recordDescription} available, but weekly wins require defined winning criteria.`,
    state: 'rules-required' as const,
    value: null,
  }
}

export function createParticipantFeaturePlaceholders(
  historyTrend: ParticipantHistoryTrend,
): ParticipantFeaturePlaceholders {
  const { latestWeighIn, recordCount } = historyTrend

  if (recordCount === 0) {
    return {
      latestRecordDate: null,
      recordCount,
      streak: noRecordsPlaceholder('streak'),
      weeklyWin: noRecordsPlaceholder('weekly-win'),
    }
  }

  return {
    latestRecordDate: latestWeighIn!.date,
    recordCount,
    streak: rulesRequiredPlaceholder('streak', recordCount),
    weeklyWin: rulesRequiredPlaceholder('weekly-win', recordCount),
  }
}

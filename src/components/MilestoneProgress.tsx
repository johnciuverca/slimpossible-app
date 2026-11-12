import type {
  ParticipantMilestone,
  ParticipantMilestones,
} from '../models/participantMilestones'
import type { GoalDirection } from '../models/targetProgress'

type MilestoneProgressProps = {
  celebrationAnnouncement?: string
  direction?: GoalDirection | null
  milestones: ParticipantMilestones
  personalGoal?: {
    currentWeightKg: number | null
    remainingWeightKg: number | null
    startingWeightKg: number | null
    statusLabel: string
    targetWeightKg: number | null
  }
  title?: string
}

type DisplayMilestoneState = 'current' | 'reached' | 'upcoming'

function milestoneState(
  milestone: ParticipantMilestone,
  currentThreshold: number,
): DisplayMilestoneState {
  if (milestone.thresholdPercentage === currentThreshold) return 'current'
  return milestone.state === 'reached' ? 'reached' : 'upcoming'
}

function stateLabel(state: DisplayMilestoneState) {
  if (state === 'current') return 'Current milestone'
  if (state === 'reached') return 'Reached'
  return 'Upcoming'
}

function trackProgressPercentage(completionPercentage: number) {
  return Math.max(0, Math.min(100, ((completionPercentage - 25) / 75) * 100))
}

function unavailableCopy(
  reason:
    'invalid-progress' | 'no-records' | 'no-target' | 'participant-not-found',
) {
  if (reason === 'invalid-progress') {
    return 'Saved progress is not a valid percentage yet. Refresh after checking your saved weigh-ins.'
  }

  if (reason === 'no-records') {
    return 'Record your first weigh-in to see milestone progress.'
  }

  if (reason === 'no-target') {
    return 'Add a target weight to begin milestone progress.'
  }

  return 'Participant progress is unavailable.'
}

function formatKg(weightKg: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(weightKg)} kg`
}

function personalGoalMessage(
  goal: NonNullable<MilestoneProgressProps['personalGoal']>,
  direction: GoalDirection | null,
) {
  if (goal.targetWeightKg === null) {
    return 'Add a personal target weight to see goal progress.'
  }

  if (goal.currentWeightKg === null) {
    return 'Record your first weigh-in to see progress toward your target.'
  }

  if (direction === 'maintain') {
    if (goal.remainingWeightKg === 0) {
      return 'Your latest saved check-in is at your maintenance target.'
    }

    return `Your latest saved check-in is ${formatKg(goal.remainingWeightKg ?? 0)} from your maintenance target. Normal fluctuations are shown without a loss-or-gain milestone scale.`
  }

  if (goal.remainingWeightKg === 0) {
    const beyondTarget =
      direction === 'loss'
        ? goal.currentWeightKg < goal.targetWeightKg
        : direction === 'gain'
          ? goal.currentWeightKg > goal.targetWeightKg
          : false

    if (beyondTarget) {
      const difference = Math.abs(goal.currentWeightKg - goal.targetWeightKg)
      return `Your latest saved check-in is ${formatKg(difference)} beyond your target. Progress remains capped at 100%.`
    }

    return 'You have reached your target weight.'
  }

  return `You are ${formatKg(goal.remainingWeightKg ?? 0)} away from your target weight.`
}

function GoalMeasurements({
  direction,
  goal,
}: {
  direction: GoalDirection | null
  goal: NonNullable<MilestoneProgressProps['personalGoal']>
}) {
  const remainingLabel =
    goal.remainingWeightKg === 0
      ? 'Reached'
      : goal.remainingWeightKg === null
        ? goal.targetWeightKg === null
          ? 'No target'
          : 'Awaiting check-in'
        : formatKg(goal.remainingWeightKg)

  return (
    <dl
      aria-label="Personal goal measurements"
      className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
        <dt className="text-xs font-semibold text-slate-600 sm:text-sm">
          Starting weight
        </dt>
        <dd className="mt-1 break-words text-lg font-bold text-slate-950 sm:text-xl">
          {goal.startingWeightKg === null
            ? 'Not available'
            : formatKg(goal.startingWeightKg)}
        </dd>
      </div>
      <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
        <dt className="text-xs font-semibold text-slate-600 sm:text-sm">
          Latest saved weight
        </dt>
        <dd className="mt-1 break-words text-lg font-bold text-slate-950 sm:text-xl">
          {goal.currentWeightKg === null
            ? 'No weigh-in yet'
            : formatKg(goal.currentWeightKg)}
        </dd>
      </div>
      <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
        <dt className="text-xs font-semibold text-slate-600 sm:text-sm">
          Personal target
        </dt>
        <dd className="mt-1 break-words text-lg font-bold text-slate-950 sm:text-xl">
          {goal.targetWeightKg === null
            ? 'No target set'
            : formatKg(goal.targetWeightKg)}
        </dd>
      </div>
      <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
        <dt className="text-xs font-semibold text-slate-600 sm:text-sm">
          {direction === 'maintain' ? 'Distance from target' : 'Remaining'}
        </dt>
        <dd className="mt-1 break-words text-lg font-bold text-slate-950 sm:text-xl">
          {remainingLabel}
        </dd>
      </div>
    </dl>
  )
}

function milestoneWeightKg(
  thresholdPercentage: number,
  direction: GoalDirection | null,
  goal: MilestoneProgressProps['personalGoal'],
) {
  if (
    !goal ||
    direction === null ||
    direction === 'maintain' ||
    goal.startingWeightKg === null ||
    goal.targetWeightKg === null
  ) {
    return null
  }

  return (
    goal.startingWeightKg +
    (goal.targetWeightKg - goal.startingWeightKg) * (thresholdPercentage / 100)
  )
}

export function MilestoneProgress({
  celebrationAnnouncement = '',
  direction = null,
  milestones,
  personalGoal,
  title = 'Milestone progress',
}: MilestoneProgressProps) {
  const titleId = `${milestones.challengeId}-${milestones.participantId ?? 'participant'}-milestones`

  if (milestones.state === 'unavailable') {
    return (
      <section
        aria-labelledby={titleId}
        className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-6 sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Milestones
        </p>
        <h2
          className="mt-3 text-2xl font-bold tracking-tight text-slate-900"
          id={titleId}
        >
          {title}
        </h2>
        {personalGoal ? (
          <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
            {personalGoal.statusLabel}.{' '}
            {personalGoalMessage(personalGoal, direction)}
          </p>
        ) : null}
        <div
          className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600"
          role="status"
        >
          <span className="mr-2 font-bold text-slate-800">Not available.</span>
          {unavailableCopy(milestones.reason)}
        </div>
        {personalGoal ? (
          <GoalMeasurements direction={direction} goal={personalGoal} />
        ) : null}
      </section>
    )
  }

  const reachedCount = milestones.milestones.filter(
    (milestone) => milestone.state === 'reached',
  ).length
  const currentThreshold =
    milestones.milestones.find(
      (milestone) =>
        milestones.completionPercentage <= milestone.thresholdPercentage,
    )?.thresholdPercentage ?? milestones.milestones.at(-1)!.thresholdPercentage
  const completionPercentage = Number.isFinite(milestones.completionPercentage)
    ? Math.max(0, Math.min(100, milestones.completionPercentage))
    : 0
  const displayedCompletionPercentage = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(completionPercentage)
  const trackProgress = trackProgressPercentage(completionPercentage)
  const directionLabel =
    direction === 'loss'
      ? 'Weight-loss goal'
      : direction === 'gain'
        ? 'Weight-gain goal'
        : direction === 'maintain'
          ? 'Maintenance goal'
          : null
  const isMaintenanceGoal = Boolean(personalGoal) && direction === 'maintain'

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-6 shadow-lg shadow-emerald-950/5 sm:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Milestones
          </p>
          <h2
            className="mt-3 text-2xl font-bold tracking-tight text-slate-950"
            id={titleId}
          >
            {title}
          </h2>
          {personalGoal ? (
            <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
              {personalGoal.statusLabel}.{' '}
              {personalGoalMessage(personalGoal, direction)}
            </p>
          ) : null}
        </div>
        <p
          className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800"
          role="status"
        >
          {personalGoal?.statusLabel ??
            `${reachedCount} of ${milestones.milestones.length} milestones reached`}
        </p>
      </div>

      <div className="mt-8">
        {directionLabel ? (
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {directionLabel}
          </p>
        ) : null}
        {isMaintenanceGoal ? (
          <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm leading-6 text-teal-950">
            Maintenance is measured by distance from your saved target. Normal
            check-in fluctuations are shown without a loss-or-gain milestone
            scale.
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm font-semibold text-slate-700">
                Target completion
              </p>
              <p className="shrink-0 text-3xl font-black tracking-tight text-emerald-800">
                {displayedCompletionPercentage}%
              </p>
            </div>
            <div className="relative mt-4 h-5">
              <div
                aria-label={`${title}: ${displayedCompletionPercentage}% complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={completionPercentage}
                aria-valuetext={`${displayedCompletionPercentage}% complete. ${reachedCount} of ${milestones.milestones.length} milestones reached.`}
                className="absolute left-[12.5%] right-[12.5%] top-1/2 h-5 -translate-y-1/2 rounded-full bg-emerald-100 shadow-inner shadow-emerald-950/10"
                data-testid="milestone-track"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-sm motion-reduce:transition-none motion-safe:transition-[width]"
                  data-testid="milestone-track-fill"
                  style={{ width: `${trackProgress}%` }}
                />
              </div>
              {milestones.milestones.map((milestone) => {
                const state = milestoneState(milestone, currentThreshold)

                return (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 border-4 bg-white shadow-sm ${
                      state === 'reached'
                        ? 'border-emerald-700'
                        : state === 'current'
                          ? 'border-teal-500 ring-4 ring-teal-100'
                          : 'border-stone-300'
                    } rounded-full`}
                    data-milestone-marker={milestone.thresholdPercentage}
                    key={milestone.id}
                    style={{ left: `${milestone.thresholdPercentage - 12.5}%` }}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {!isMaintenanceGoal ? (
        <ol
          aria-label="Milestone status"
          className="mt-7 grid grid-cols-4 gap-0"
        >
          {milestones.milestones.map((milestone) => {
            const state = milestoneState(milestone, currentThreshold)
            const milestoneWeight = milestoneWeightKg(
              milestone.thresholdPercentage,
              direction,
              personalGoal,
            )

            return (
              <li
                className={`mx-1 min-w-0 rounded-2xl border px-1 py-3 text-center sm:mx-1.5 sm:px-3 ${
                  state === 'reached'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : state === 'current'
                      ? 'border-teal-300 bg-teal-50 text-teal-950 ring-2 ring-teal-100'
                      : 'border-stone-200 bg-white text-slate-600'
                }`}
                data-milestone-card={milestone.thresholdPercentage}
                data-state={state}
                key={milestone.id}
              >
                <p className="text-lg font-black">
                  {milestone.thresholdPercentage}%
                </p>
                {milestoneWeight === null ? null : (
                  <p className="break-words text-xs font-semibold sm:text-sm">
                    {formatKg(milestoneWeight)}
                  </p>
                )}
                <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide sm:text-xs">
                  {stateLabel(state)}
                </p>
              </li>
            )
          })}
        </ol>
      ) : null}

      {personalGoal ? (
        <GoalMeasurements direction={direction} goal={personalGoal} />
      ) : null}

      {celebrationAnnouncement ? (
        <p aria-live="polite" className="sr-only" role="status">
          {celebrationAnnouncement}
        </p>
      ) : null}
    </section>
  )
}

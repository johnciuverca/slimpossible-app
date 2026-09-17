import type {
  ParticipantMilestone,
  ParticipantMilestones,
} from '../models/participantMilestones'

type MilestoneProgressProps = {
  milestones: ParticipantMilestones
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

function unavailableCopy(
  reason: 'no-records' | 'no-target' | 'participant-not-found',
) {
  if (reason === 'no-records') {
    return 'Record your first weigh-in to see milestone progress.'
  }

  if (reason === 'no-target') {
    return 'Add a target weight to begin milestone progress.'
  }

  return 'Participant progress is unavailable.'
}

export function MilestoneProgress({
  milestones,
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
        <div
          className="mt-5 rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm leading-6 text-slate-600"
          role="status"
        >
          <span className="mr-2 font-bold text-slate-800">Not available.</span>
          {unavailableCopy(milestones.reason)}
        </div>
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
        </div>
        <p
          className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800"
          role="status"
        >
          {reachedCount} of {milestones.milestones.length} milestones reached
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <p className="text-sm font-semibold text-slate-700">
            Target completion
          </p>
          <p className="text-3xl font-black tracking-tight text-emerald-800">
            {milestones.completionPercentage}%
          </p>
        </div>
        <div
          aria-label={`${title}: ${milestones.completionPercentage}% complete`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={milestones.completionPercentage}
          aria-valuetext={`${milestones.completionPercentage}% complete. ${reachedCount} of ${milestones.milestones.length} milestones reached.`}
          className="relative mt-4 h-5 rounded-full bg-emerald-100 shadow-inner shadow-emerald-950/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-sm transition-[width]"
            style={{ width: `${milestones.completionPercentage}%` }}
          />
          {milestones.milestones.map((milestone) => {
            const state = milestoneState(milestone, currentThreshold)

            return (
              <span
                aria-hidden="true"
                className={`absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white shadow-sm ${
                  state === 'reached'
                    ? 'border-emerald-700'
                    : state === 'current'
                      ? 'border-teal-500 ring-4 ring-teal-100'
                      : 'border-stone-300'
                }`}
                key={milestone.id}
                style={{ left: `${milestone.thresholdPercentage}%` }}
              />
            )
          })}
        </div>
      </div>

      <ol
        aria-label="Milestone status"
        className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {milestones.milestones.map((milestone) => {
          const state = milestoneState(milestone, currentThreshold)

          return (
            <li
              className={`rounded-2xl border px-3 py-3 text-center ${
                state === 'reached'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : state === 'current'
                    ? 'border-teal-300 bg-teal-50 text-teal-950 ring-2 ring-teal-100'
                    : 'border-stone-200 bg-white text-slate-600'
              }`}
              data-state={state}
              key={milestone.id}
            >
              <p className="text-lg font-black">
                {milestone.thresholdPercentage}%
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide">
                {stateLabel(state)}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

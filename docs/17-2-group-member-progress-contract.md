# 17.2 — Group member progress and privacy contract

Issue #253 under parent #248. This is the behavior contract for the selected
Group's spreadsheet-style member progress bar. It does not authorize UI, SQL,
production, or hosted-data changes in this issue.

## Spreadsheet alignment

The primary `Slimpossible–The Weighed-In Warriors` sheet uses each participant's
starting weight, current target, and latest qualifying recorded weight. It
clamps completion to 0–100%, rounds the filled portion to the nearest of ten
blocks, and formats the percentage as a whole percent. The Group version keeps
that calculation but replaces the private sheet's current-weight source with
the latest valid, non-future weigh-in explicitly shared to the selected group.

For a positive start `S`, positive loss target `T`, and current qualifying
weight `C`, where `0 < T < S`:

```text
fraction = clamp((S - C) / (S - T), 0, 1)
percentage = fraction × 100
filled blocks = round(fraction × 10)
```

Show the start and current target beside the bar. Render ten equal blocks and a
whole-percent label, matching the spreadsheet's display precision. A current
weight at or below the target is 100%; a gain above the start clamps to 0%.
Keep raw actual-kg history and weekly-winner calculations separate from this
goal-completion projection.

## Goal and evidence rules

- `S` is the member's enrollment baseline for this challenge. Changing a target
  never changes that baseline. Any correction to erroneous enrollment data is a
  separate, explicit correction flow—not a target edit.
- `T` must be positive, represented at 0.01 kg precision, and strictly below
  `S`. A target equal to `S` is immediately reached: show 100% and allow a
  lower replacement target without inventing a weigh-in date. A target above
  `S` is invalid for this weight-loss contract and progress is unavailable.
- `C` is the latest valid actual weight explicitly shared to this challenge,
  dated on or after enrollment and no later than today. Missing or invalid
  `S`, `T`, or `C` makes progress unavailable, except for the equal-start
  reached case above. An unshared, pre-enrollment, future, or other-challenge
  entry never supplies `C`.
- Before a target is reached, its owner may adjust it within the valid range.
  After it is reached, a replacement must be strictly lower than the reached
  target. Preserve the achieved target and date/state as a milestone; derive a
  group-visible milestone only from qualifying evidence explicitly shared to
  this same challenge.
- Recompute after a correction, target change, deletion, or unshare. On account
  or group switches, membership changes, loading, or authorization/data errors,
  hide stale rows and fail closed. Never fall back to another group's data.

## Disclosure and privacy

Only authenticated members currently eligible for the selected group may see
its member bars, enrollment starts, current targets, and progress; the selected
group owner retains the existing authorized access. This does not authorize a
public directory, withdrawn/outsider access, or visibility in another group.
Do not expose notes, private/unshared weigh-ins, raw user or participant IDs,
or another challenge's data. Use enrollment values from that member's
enrollment in this challenge, not profile-wide values.

Participant-facing enrollment copy must disclose the bar's start/target/progress
visibility separately from explicit weigh-in sharing. Suggested copy:

> Current members of this group and its owner can see your enrollment starting
> weight, current target, and progress. Only dates and weights you explicitly
> share with this group are used as current progress evidence; your notes remain
> private. This does not share your progress with other groups.

The current enrollment disclosure covers explicitly shared dates/weights and
private notes, but does not yet name starting weight, target, or progress. Carry
the disclosure into the later authorized Group UI work; this issue does not
change enrollment or Group UI.

## Existing regression evidence

The staging implementation already exercises most of this contract:

- `src/models/groupMemberProgress.test.ts` checks ten-block rounding, clamping,
  and hiding stale rows across account/group context changes.
- `src/models/ownDashboardGoal.test.ts` covers selected-group explicit shares,
  pre-enrollment/future/other-group exclusions, equal-start completion,
  above-start invalidity, and own/active membership boundaries.
- `supabase/tests/group_member_progress_projection_authorization.sql` covers
  latest shared non-future evidence, clamped loss progress, missing/equal/invalid
  targets, safe projection columns, membership denial, correction, deletion, and
  unshare refresh behavior.
- `supabase/tests/target_change_authorization.sql` covers positive two-decimal
  targets below the enrollment start, self-only updates, the stricter post-reach
  bound, preserved start, and shared-evidence milestone behavior.
- `src/auth/groupMemberProgressProjectionMigration.test.ts` pins the projection
  SQL access, return shape, and rollback contracts. The two SQL regression files
  are explicitly local/disposable-database tests; they are not live acceptance.

One presentation detail remains for the later Group UI issue: the projection
currently retains one decimal place and the Group label renders that value
directly, while the sheet displays a whole percent. Preserve projection
precision if useful, but round the visible label to the spreadsheet's whole
percent when the Group bar presentation is implemented. No presentation change
is made here.

## Scope boundary

This issue defines and records the contract only. Target-update persistence,
projection migrations, bars/actions, and participant-facing UI changes remain in
their ordered issues. No private spreadsheet names, values, or records are
copied into repository history.

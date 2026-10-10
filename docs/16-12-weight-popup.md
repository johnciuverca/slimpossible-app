# 16.12 — Reusable weight popup and own-entry actions

Issue #245, parent #199. Based on staging
`1349e2f0a96d73cea14908512c0d30dc8957824f` after PR #242.

## Scope and behavior

- Dashboard retains no-challenge Record weight. Record and Edit reuse
  `RecordWeightDialog` and the canonical `PersonalWeighInEditor`, with initial
  weight focus, explicit Tab boundaries, native modal semantics and focus return.
  Cancel/clean dismissal returns to the trigger; successful mutation returns to
  the stable Record weight action after refresh, since the original row may vanish.
- Dirty Escape, Close and Cancel edit use the same Stay/Discard confirmation as
  navigation. In-flight forms cannot change inputs or submit twice.
- Delete is a separate confirmation, not a recording form. It shows date/weight,
  warns that the personal entry is removed from ALL shared groups and cannot be
  undone, defaults focus to Cancel and preserves data on cancel/failure.
- My progress's personal cards and challenge-linked progress offer own actions.
  Group adds a clearly labeled own-entry list in All members overview only, below its unchanged chart/matrix,
  filtered by the selected group's explicit shares. Other members' matrix rows
  have no edit/delete controls. Personal notes are never rendered in this list;
  they are loaded only by the author's authorized personal workspace/editor.
- Save/delete triggers an account-scoped signal so mounted personal histories,
  summaries and group chart/history refresh. Existing keyed snapshots and
  active-request guards hide prior account/challenge data and ignore late work.
- Weigh-in is removed only from primary navigation. Old `/weigh-ins` links retain
  the existing canonical form and use the same separate Delete confirmation.
  Goals, Challenges and My progress destinations remain.
- Accepted Group navbar/action spacing, group-only contexts, normal page flow,
  sticky member tabs, history matrix and privacy projection are preserved.
- No SQL, RPC output, RLS, auth, production, ranking or sharing-default changes.
  No #247 live release or #248 redesign. All test records are disposable fixtures.

## Verification

- Standard local lint/typecheck/format/build and diff checks pass; existing
  large-bundle warning remains. Full unit suite was run once; obsolete native
  confirmation assertions and ordered-response fixture interference were repaired
  and the affected files rerun. Focused page/action/refresh unit checks pass.
- Desktop and mobile browser checks cover no-challenge Dashboard recording,
  today's canonical edit, preserved notes/shares, separate deletion/cancellation,
  old links, account isolation, dirty dismissal, keyboard focus trapping/return,
  Group own-vs-other controls and cross-group disposable deletion/refresh.
- Responsive navbar geometry remains matched to Dashboard at 1280x900, 768x900,
  390x568 and 320x568. Group's existing history/member/sticky tests pass.
- Required full CI runs on the published PR head. These synthetic observations
  are not connected owner acceptance, which is **NOT EXECUTED** for this issue.

## Member-tab visibility correction — 2026-10-10

- PM relayed owner acceptance of the original popup, unsaved guard, personal
  save/edit/delete and Group own-entry/refresh/read-only behavior. Owner found
  the own-entry list incorrectly remained visible under another member's tab.
- The list is now supplied to GroupChartHistory as overview-only content, hidden
  on every individual member tab, including while that selection refreshes.
  Returning to All members restores selected-group-only author actions.
- The RPC supplies an opaque `md5(challengeId:userId)` member key, but personal
  records and the existing UI have no own-member key mapping/marker. This scoped
  fix uses the authorized conservative fallback instead of adding client identity
  derivation: **own-member tabs also remain read-only**. No display-name/date/weight
  matching, new dependency, SQL, RPC projection or RLS change.
- Focused unit tests cover duplicate-name tabs and correction refresh. Desktop
  and mobile browser tests switch both duplicate-name members and return by
  keyboard to All members, retaining canonical own edit/delete/refresh checks.
- Connected owner retest of this visibility correction is pending; no merge.

## Owner preview checks (disposable entries only)

1. On Dashboard without a challenge, Record weight. Confirm private default,
   today's existing-entry correction and optional explicit group shares.
2. From My progress, Edit a disposable entry. Confirm date/weight/private note
   and checked shares; change a value, Escape, Stay, then Discard. Nothing saves.
3. On Group's All members overview, confirm only your selected-group shared entries
   offer Edit/Delete. Select any individual member: own actions disappear. Return
   to All members: they reappear. Individual tabs/matrix stay read-only; no notes.
4. Delete a disposable entry shared with two groups: check warning/date/weight,
   Cancel first, then confirm. Check personal history and both groups refresh.
5. At narrow mobile width, use keyboard Tab/Shift+Tab/Escape and check focus
   return, sticky member tabs and normal scrolling. Try an old `/weigh-ins` link.

Leave the draft staging PR unmerged for independent review and owner approval.

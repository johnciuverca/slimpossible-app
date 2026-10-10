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
  Group uses compact cards inside its existing date/member history matrix, with
  accessible Edit/Delete icons only in the viewer's explicitly shared cells.
  These controls work in All members and the viewer's individual tab. Other
  members stay read-only, even with duplicate names and identical dates/weights.
  There is no duplicate Group entry list. Personal notes stay inside the editor.
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

## Member-tab visibility correction — 2026-10-10 (superseded)

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

## Single-matrix card revision — 2026-10-10

- Replaces the overview-only list/fallback above at the owner's request. The
  existing date rows, member columns, tabs and chart remain; weight cells are
  compact cards and only proven own cells receive accessible icon actions.
- PM approved exact `js-md5@0.9.2` (MIT, no runtime dependencies) to reproduce
  PostgreSQL's existing `md5(canonicalGroupUuid:canonicalAuthUserUuid)` key.
  MD5 compatibility is not authorization: author-scoped RPC/RLS still controls
  reads/writes. No SQL/schema/RLS/RPC-output changes or raw identity exposure.
- Personal date lookup occurs only after exact own-column identification. The
  workspace must be remote, current-account and ready (including contexts), and
  the personal entry must explicitly share with the selected group. Otherwise
  controls fail closed. Group weights continue to come from the Group RPC.
- Independent Node-crypto vectors cover canonicalization and group/viewer
  isolation. Ownership unit checks cover duplicate names/identical values,
  unshared entries, loading/error, local persistence and account change.
- Desktop/mobile browser checks cover own/other tabs, identical values, edit
  Escape cancellation, preserved private note/shares, selected-group edit,
  delete cancellation, cross-group delete refresh and focus return. Existing
  Group matrix/sticky/privacy/selection tests remain passing.
- The lockfile adds only the pinned dependency; existing packages are unchanged.
  Current audit has two pre-existing high dev-dependency findings
  (`brace-expansion`, `source-map-js`), none for `js-md5`; no unrelated upgrades.
- Connected owner acceptance of this new matrix-card revision: **NOT EXECUTED**.
  Draft staging PR remains unmerged pending independent review/owner approval.
- Local revision validation: 470 unit tests across 78 files; 10 Group browser
  tests; six popup/header browser tests (four header viewport sizes); lint,
  typecheck, format, build and diff checks pass. Existing bundle warning remains.

## Owner preview checks (disposable entries only)

Styling follow-up: weight and small unfilled Edit/Delete icons share one
horizontal line, with reduced card padding/gaps. Keyboard focus stays visible;
coarse-pointer devices retain 44px hit targets. Ownership, dialogs and privacy
behavior are unchanged. Connected visual acceptance is pending.

1. On Dashboard without a challenge, Record weight. Confirm private default,
   today's existing-entry correction and optional explicit group shares.
2. From My progress, Edit a disposable entry. Confirm date/weight/private note
   and checked shares; change a value, Escape, Stay, then Discard. Nothing saves.
3. On Group, confirm one history matrix and no duplicate own-entry section.
   Your shared weight cards have Edit/Delete icons in All members and your own
   tab. Another member's tab/cells stay read-only, including duplicate names and
   identical values. Switch groups: actions follow only your explicit shares.
4. Delete a disposable entry shared with two groups: check warning/date/weight,
   Cancel first, then confirm. Check personal history and both groups refresh.
5. At narrow mobile width, use keyboard Tab/Shift+Tab/Escape and check focus
   return, sticky member tabs and normal scrolling. Try an old `/weigh-ins` link.

Leave the draft staging PR unmerged for independent review and owner approval.

# 16.12 follow-up: one own-entry history

Issue #250, parent #199, follows merged #245 / PR #249. This PR targets staging
only. Release preparation #247 remains separate and pending owner acceptance.

## Cause and change

Challenge-context My progress rendered the same personal records in the
existing private history table and a second `PersonalEntryActions` list.
Edit/Delete now live in the existing table's weight card. The controls use the
same already-authorized personal-record and challenge-context snapshot as the
table, rather than fetching a second independent list. Date matching happens
only inside that author's canonical personal history; display names and shared
weights are never used to identify an owner. Account/request-key changes hide
old snapshots; keyed actions close stale dialogs on account/challenge switches.

The accepted compact weight card is shared with Group without changing its
markup/style, two-decimal presentation, centered read-only labels, matched
editable icon gaps, dimensions or practical targets. Group ownership resolution,
chart, columns, sticky stacking and dialog behavior are unchanged.

## Audit and privacy distinction

- Dashboard: personal summary/trend plus the record action; no duplicate own
  action list.
- Standalone My progress: one personal history with actions already integrated
  into record cards; unchanged.
- Challenge-context My progress: one personal table with integrated controls.
  Its separately labelled selected-group shared table remains a distinct
  read-only dataset. It contains only server-authorized shared dates/weights,
  never private notes. Both tables legitimately coexist.
- Group: own controls remain inside the existing member/date matrix, other
  members read-only; no second action list.
- Legacy Weigh-ins: one personal history with integrated record-card controls;
  unchanged. The route remains supported.

No personal records, private notes, sharing settings or datasets are deleted by
this presentation change. Existing reusable dialogs and the all-shared-groups
delete warning are retained. No schema/RLS, hosted data or production changes.

## Verification

Page composition tests render real controls; the mock that hid the duplicate
component is removed. Tests cover personal/shared separation, same-value other
members, account/challenge switches and stale-dialog removal. Desktop/mobile
browser journeys edit a disposable own record, verify both histories refresh,
switch groups, cancel deletion and restore focus, then delete and confirm only
the own record disappears. Group's existing desktop/mobile/coarse-pointer card,
chart, ownership and mutation regressions also run unchanged.

Owner connected/visual acceptance: **NOT EXECUTED for this follow-up**. Preview
health and fixture tests are not live acceptance.

Owner check: open My progress with a selected challenge; confirm a single
personal table with Edit/Delete in its weight cells and no action-only list.
The independently labelled shared table should remain. Edit/delete only an
authorized disposable own entry, check refresh and cancel/focus, then check
Dashboard, standalone My progress, Group and the legacy Weigh-ins route.

Leave the PR unmerged until independent PM review and explicit owner approval.

# 16.4 — Authorized Group charts and exact weight history

Issue #211, parent #199. Branch starts at staging `ee212008`; #242's pending
layout work is deliberately excluded and remains separate/unmerged.

## Product and read contract

The Group placeholder is replaced with a comparison chart and dated exact-kg
table for the selected authorized group. Production uses only
`get_group_chart_history(uuid)`, an additive security-definer RPC. It projects
`member_key`, `display_name`, `recorded_date`, and `weight_kg` from canonical
personal entries joined to explicit shares for that group. No notes, emails,
raw user/participant IDs, private-only entries or unrelated groups are returned.
Owners and active members may read; outsiders, anonymous/sessionless callers,
withdrawn viewers and personal-challenge requests are denied. Withdrawn authors'
entries and future dates are excluded. Draft and active groups follow the same
existing read authorization contract. The previous history RPC is unchanged.

A member key is needed because display names are not unique. It is an opaque
digest of group ID plus author UUID, not an authorization credential. It is
stable within the group and differs between groups; raw identifiers are not
projected. Duplicate display names remain separate chart series and receive
visible member ordinals. Authorization continues to happen on the server.

The chart shows **kg change from each person's first shared entry**, not their
private enrollment weight, absolute lowest weight, or a winner score. First
shared dates are labeled in the legend; negative means loss, positive gain,
zero maintenance. Only consecutive calendar dates connect; missing dates are
gaps, never interpolated check-ins. Single-entry series have one zero marker.
The table provides all exact weights, dates and baseline changes as the
accessible chart equivalent. It and the chart have keyboard-focusable horizontal
scroll regions on mobile. Coincident points/ties can overlap visually; the table
retains every member's value.

Late entries can move the first-shared baseline. Corrections, unsharing and
deletion recalculate the next authorized read. Group's existing Refresh shared
progress reloads chart, summary and both ranking views; successful recording
from Group now triggers that same reload. Returning from other recording pages
loads fresh reads. No realtime subscription is claimed. Sunday-to-Sunday and
provisional ranking formulas are unchanged and independent of the chart.

Snapshots are keyed by account/challenge/refresh, stale responses ignored,
and old rows hidden synchronously. Missing RPC/migration or denied access shows
an unavailable state; there is no fallback to private rows or synthetic data.
No chart data is persisted in the browser.

## Migration and connected gate — NOT EXECUTED

Forward: `supabase/migrations/20261009000000_add_group_chart_history.sql`.
Inverse: `supabase/rollback/20261009000000_add_group_chart_history.sql`.
The forward migration adds only the read RPC and restricted execute ACL; it
does not modify tables, backfill data, widen raw-row policies or change rankings.
The inverse removes only the new RPC and preserves all entries, shares and the
old history contract. Applying it leaves this UI honestly unavailable.

Before hosted staging execution: obtain independent PM migration review,
specific owner approval, a fresh verified recoverable backup and a private
non-mutating connection check. Existing canonical #210 and draft-sharing
migrations must be applied. Do not run hosted SQL or modify production under
this implementation approval. Vercel/CI green does not apply the database RPC.

`supabase/tests/group_chart_history_authorization.sql` is rollback-only and
requires three distinct owner-approved existing disposable Auth UUIDs supplied
privately. It fails before fixtures for missing/duplicate identities. It creates
only temporary challenge/member/weight fixtures and rolls them back; it never
creates Auth users. Never use real personal accounts or Production. Credentials
and populated identities must not be committed.

## Local validation — 2026-10-08

- Format/lint/typecheck/build/diff checks pass; existing bundle warning remains.
- 442 unit tests pass across 74 files. Coverage includes baseline/gain/maintenance, duplicate names, late rows,
  corrections/removals, stale account/challenge responses, missing RPC, privacy
  projection, and successful-save refresh wiring.
- 75 browser tests pass (69 application + 6 Group). Group tests at 1280/390px
  cover exact weights, duplicate names, chart/table accessibility and contrast,
  truthful selected-group refresh, gains/maintenance, correction, empty/loading/
  denied history, future suppression and keyboard scrolling without page overflow.
  Network requests use intercepted synthetic services, not connected acceptance.
- Local socket-only native PostgreSQL rehearsal passed: 11 named chart checks
  plus five denial guards, 32 existing canonical/privacy/ranking assertions,
  additive rollback, legacy RPC preservation, and forward reapply. It uses the
  existing local Auth compatibility shim, not actual hosted Supabase Auth.
- Read-only in-app visual inspection of the labeled synthetic fixture confirmed
  kg/date labels, separate gain/loss series, missing-date gaps, legend and exact
  weight table. `e2e/fixtures/group-chart-harness.html` is test-only and never used
  as a production data fallback.

## Owner/PM connected acceptance — NOT EXECUTED

After separately approved staging migration and privacy checks:

1. Use approved disposable owner/member accounts. In Group, verify only selected
   group's explicitly shared dates/weights appear; private notes/emails and other
   groups do not appear in UI or RPC projection. Test draft and active groups.
2. Verify duplicate names stay separate, gains/maintenance/single entries render
   honestly, table kg is exact, missing dates are gaps, and mobile/keyboard scroll
   regions remain usable. Compare each member with their own first shared weight.
3. Add a late shared entry, correct it, unshare and delete. Refresh and verify chart,
   table and summaries follow current shares, while Sunday/provisional formulas
   are unchanged. Record from Group should refresh automatically after success.
4. Switch challenge/account during loading: no old rows flash or reappear.
   Outsider/withdrawn direct links must fail safely. Confirm personal Dashboard,
   home and Today remain personal and canonical recording/privacy are intact.
5. Record dated, redacted results against the exact PR head/environment. Leave
   the PR unmerged until PM review and owner acceptance; production is separate.

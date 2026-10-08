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

## Hosted staging migration — APPLIED 2026-10-08; browser acceptance pending

Forward: `supabase/migrations/20261009000000_add_group_chart_history.sql`.
Inverse: `supabase/rollback/20261009000000_add_group_chart_history.sql`.
The forward migration adds only the read RPC and restricted execute ACL; it
does not modify tables, backfill data, widen raw-row policies or change rankings.
The inverse removes only the new RPC and preserves all entries, shares and the
old history contract. Applying it leaves this UI honestly unavailable.

PM reported applying the owner-approved additive RPC through Supabase SQL Editor
on `slimpossible-staging` (project `erylzsdmsohvssgqwfor`) on 2026-10-08,
after fresh backup recovery verification. The applied SQL matched the migration
at implementation head `03e94ea87abf8a4125c7f23ff8a7275c2f446bfd`; only comments
and whitespace were compacted. The transaction reported Success. This was SQL
Editor execution, not a Supabase migration-ledger entry or repair. A did not
execute hosted SQL.

PM-reported preflight: `connection_ok=1`, chart RPC absent, canonical/shares
tables ready, 16 canonical entries and 5 shares. Completed postchecks:
sessionless calls denied by the DO guard; security definer enabled; fixed
`pg_catalog, public, auth` search path; only member key, display name, recorded
date and kg projected; anonymous EXECUTE false; authenticated EXECUTE true;
entry/share counts unchanged at 16/5. The retained local SQL Editor proof
`slimpossible-211-staging-verification.jpg` was inspected by A and visibly
confirms anonymous false, authenticated true and 16 entries. The 5-share result
is PM-reported; its screenshot column is obscured by an editor overlay.

These are migration/catalog/access/count checks, not executed owner/member
browser acceptance or the full connected privacy matrix. No hosted Auth
identities, private row values or credentials are included in this evidence.
No PR merge or production change is authorized by the staging approval.
Vercel/CI green is still separate from connected acceptance.

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
- Fresh database-archive recovery passed in a new internal-only, no-published-port
  Docker database. The original backup checksum remained unchanged. Aggregate
  orphan/index/constraint checks passed; RLS and checked privacy ACLs remained
  intact. Exact #211 forward/inverse/reapply preserved all 46 snapshotted tables,
  existing public function definitions/ACLs, managed-role flags/memberships and
  selected-group history/ranking outputs. The new local resources were stopped
  and retained; owner containers/backups remained untouched. This proves archive
  recoverability relative to that backup, not source completeness without a
  source manifest, live Auth configuration/sign-in, or Storage object bytes.

## Owner/PM connected browser/privacy acceptance — NOT EXECUTED

The staging function is applied and its basic checks above are complete. The
rollback-only connected privacy harness and full owner/member browser matrix
remain unexecuted; obtain the required approved disposable identities and
complete those checks before merge acceptance:

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

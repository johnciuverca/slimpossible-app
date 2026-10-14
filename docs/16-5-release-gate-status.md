# 16.5 — Connected sharing release gate status

Issue #212 remains **OPEN / NOT READY FOR RELEASE**. This record reconciles
the prior staging evidence with the current staging source; it does not claim
that an unexecuted live journey passed and does not authorize production
configuration, migration, deployment, or issue closure.

## Current candidate and inherited evidence

- Current staging merge commit: `ac6372183ffd121e1ac7832d382c2bfbf816289e`
  (PR #272), based on `32a28f9356168b70c512ec5236731d2225f6e895` (PR #268).
- The prior connected sharing walkthrough and read-only database probe in
  [15.8 staging evidence](15-8-staging-verification.md) were performed on
  `e181f8099611d4cf8e1b8ff91b43e072a7a6f5df` (PR #270 test-only merge).
- PR #272 changes only `src/components/DashboardGoals.tsx` and its component
  tests. It handles a valid empty target-history result in the UI; sharing,
  group history, scoring, database functions, migrations, grants, and policies
  are unchanged. The owner accepted the targeted #271 preview for that Goals
  behavior. Since the source diff is isolated from the previously exercised
  sharing and privacy paths, the #268 one-group sharing walkthrough and
  read-only database evidence carry forward; the different staging SHA alone
  does not require replaying those unchanged checks.
- GitHub reports the current staging commit's Vercel status as **success**.
  That status alone does not verify the deployed project's backend assignment
  or remote migration ledger for this exact commit.
- PR #272's exact-head Quality rerun passed formatting, lint, typecheck, all
  unit tests, production build, and browser smoke. Its Vercel preview passed.
  These checks are automated evidence, not a substitute for the connected
  acceptance items still listed below.

## Evidence already recorded

The #268 evidence record reports one explicit group share, a member's
read-only view without the author's note or edit/delete controls, writer
unsharing, and cleanup of the synthetic entry while preserving prior records.
It also records a read-only PostgreSQL role/GUC authorization probe that
denied sessionless and unrelated authenticated caller simulations with
`42501`, emitted no personal rows, and rolled back. That is not signed-JWT or
HTTP evidence; it did not cover anonymous/withdrawn requests or the target
milestone RPC.

Local tests cover optional group choices, privacy-safe selected-group
projections, chart/history recomputation after corrections, late baselines,
unsharing and deletion, and weekly partial participation/ties. They establish
the tested local contracts only. Connected evidence still lacks a
multiple-selected-group journey and late/corrected Sunday outcomes; the
accepted one-group path does not need replay solely because the unrelated
Goals component changed.

## Remaining acceptance and release blockers

| Area                             | Existing evidence                                                                                                                                                                                                                                                                                                                                                         | Remaining action                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Optional multiple-group sharing  | One explicitly selected group was connected-tested; local tests cover optional choices, edits, refresh, and account isolation. The owner accepted the targeted Goals preview.                                                                                                                                                                                             | Connected-test the still-missing multiple-eligible-group path and confirm only selected groups receive date/weight, never the note. Do not replay the accepted one-group path solely because the SHA changed.                                                                                                                                                                                                      |
| No-share and membership/privacy  | Personal-only and one-group journeys were connected-tested. A member and unrelated signed-in reader were checked in the UI. Local authorization tests cover anonymous/withdrawn cases. The staging role/GUC probe checked the canonical RPC fingerprint, catalog/ACL/self-conditions, and denied sessionless and unrelated authenticated caller simulations with `42501`. | Reconcile the specific #212 direct server/RPC denial cases against the existing SQL and local tests; execute only any uncovered case, such as inappropriate owner access. Role/GUC evidence is database-side, not signed-JWT/HTTP evidence; JWT/HTTP is not a new requirement imposed here.                                                                                                                        |
| Group charts and Sunday outcomes | Local chart/history tests cover corrections, late baselines, unsharing, deletion, partial participation, and ties; earlier connected read-only Group checks remain applicable because those paths did not change.                                                                                                                                                         | Connected evidence is still needed for a late/corrected entry updating the relevant chart/table and provisional/final Sunday results, including agreed partial-week and tie behavior.                                                                                                                                                                                                                              |
| Accessibility and failure states | Existing connected 390px keyboard/navigation evidence and automated failure/empty/loading coverage remain relevant; #272 is limited to Goals empty-history presentation and its targeted preview was owner-accepted.                                                                                                                                                      | No blanket desktop/mobile replay is required for unrelated unchanged screens. Record only concrete unresolved accessibility or failure-state issues found during the remaining scoped checks.                                                                                                                                                                                                                      |
| Migration/configuration/recovery | The source migration order and selected guarded rollback files are inventoried in [release workflow](release-workflow.md). The staging backend assignment and a read-only catalog/ACL probe are already in #268 evidence.                                                                                                                                                 | Reconcile the actual staging schema/grants with the approved migration set and available migration-history records, accounting for manually applied migrations. Use read-only evidence; do not repair the ledger or rerun SQL. Production configuration, recoverability, and post-deploy smoke/disable planning remain a separate owner-approved production gate. No backend URL reconfirmation is requested here. |

No hosted writes, accounts, migrations, grants, policies, environment settings,
production deployments, or issue closures were performed for this status
review. #207, #212, and #155 remain open; #247 remains paused. Production
release remains a separate owner-approved action after this gate is complete.

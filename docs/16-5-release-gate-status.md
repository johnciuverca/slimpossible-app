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
  `e181f8099611d4cf8e1b8ff91b43e072a7a6f5df` (PR #270 test-only merge), not
  on this current candidate.
- Comparing those source trees, PR #272 changes only
  `src/components/DashboardGoals.tsx` and its component tests. It handles a
  valid empty target-history result in the UI; it does not alter sharing,
  group history, scoring, database functions, migrations, grants, or policies.
  This narrow diff makes the earlier sharing observations useful context, but
  does not turn them into exact-`ac637218` connected evidence.
- GitHub reports the current staging commit's Vercel status as **success**.
  That status alone does not verify the deployed project's backend assignment
  or remote migration ledger for this exact commit.
- PR #272's exact-head Quality rerun passed formatting, lint, typecheck, all
  unit tests, production build, and browser smoke. Its Vercel preview passed.
  These checks are automated evidence, not connected-account acceptance.

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
the tested local contracts only. The staging evidence has not demonstrated
the issue's no-share and multiple-selected-group save/edit/refresh/account-
switch paths or exact-current-candidate late/corrected Sunday results.

## Remaining acceptance and release blockers

| Area                                         | Evidence status                                                                                                                                                            | Still required before #212 can pass                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No-share and optional multiple-group sharing | One selected group was connected-tested on `e181f80`; local coverage exists                                                                                                | On current staging, exercise no selected groups and multiple eligible groups across save, edit, reload, and account switch; verify only selected groups receive date/weight and never the private note. Clean up only the explicitly approved synthetic fixture.                                                  |
| Reader privacy and membership                | One active member and one unrelated signed-in account were UI-tested; SQL role/GUC probe passed                                                                            | Exact-current-candidate check for direct server/RPC denials covering unauthenticated and withdrawn membership, plus cross-group/owner boundaries. Do not characterize the role/GUC probe as HTTP/JWT evidence.                                                                                                    |
| Group charts and Sunday outcomes             | Local model, repository, component, and SQL harness coverage exists; earlier connected observations are candidate-scoped                                                   | On current staging, verify late/corrected records refresh the selected group's chart/table and provisional/final Sunday views; record the agreed Sunday window, partial participation, and tie result without retaining personal data.                                                                            |
| Accessibility and failure states             | Automated keyboard/mobile and component states are recorded; connected mobile pass is partial                                                                              | Record the bounded current-candidate desktop/mobile keyboard, focus, labels, loading/empty/error, and failure-state checks. A broad WCAG audit is not a separate release gate unless a concrete issue is found.                                                                                                   |
| Migration/configuration/recovery             | Fifteen checked-in migrations and selected guarded rollback scripts are inventoried in [release workflow](release-workflow.md); #268 contains a read-only schema/ACL probe | Owner must confirm the exact staging migration ledger and backend assignment in private settings, review backup/restore recoverability, and document the production migration/configuration and post-deploy smoke/disable plan before separately approving any production release. No migration is proposed here. |

No hosted writes, accounts, migrations, grants, policies, environment settings,
production deployments, or issue closures were performed for this status
review. #207, #212, and #155 remain open; #247 remains paused. Production
release remains a separate owner-approved action after this gate is complete.

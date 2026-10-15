# 16.5 — Connected sharing release gate status

Issue #212 remains **OPEN / NOT READY FOR RELEASE**. This record reconciles
the prior staging evidence with the current staging source; it does not claim
that an unexecuted live journey passed and does not authorize production
configuration, migration, deployment, or issue closure.

## Current candidate and inherited evidence

### 2026-10-15 reconciliation

**Verdict: NOT READY.** The observations below are partial connected evidence.
They do not close #212, #207, #208, or their parents.

- A fresh `git ls-remote` resolved staging to
  `cfb6c0217a5879d9020b4b4c349f90a625f67f9e` and the tested branch
  `codex/17-6-group-readability` to
  `17d22d8fce0c77654de5b3ff7ce429306bd79e5d`.
- GitHub Preview deployment `7072125166` associates that branch commit with
  successful immutable Preview `https://slimpossible-ly4mxgcqe-cvc10.vercel.app`.
  PM identified the branch Preview as today's test surface. The agent did not
  independently inspect the deployed JavaScript or backend assignment today.
- The complete source diff from that Preview commit to staging contains only
  `docs/17-2-group-member-progress-contract.md` and
  `supabase/tests/target_change_authorization.sql`. Application source and
  migration files are identical; this establishes source equivalence, not a
  fresh hosted-schema or runtime-configuration attestation.
- Quality run `38616319293` / #256 succeeded on PR #279 head
  `647517a603967e96a97cb50ca952784bd2b96f94`, whose tree matches staging.
  This is inherited automated evidence, not a suite rerun by this update.
- On 2026-10-15 this agent ran
  `bash supabase/tests/run_local_group_chart_history.sh` from the staging source.
  All 12 chart-history and 32 canonical personal authorization assertions
  passed, followed by the populated-date/injected-failure preservation guards,
  exhausted-date guard and additive chart rollback/re-forward check. The runner
  used synthetic identities in a fresh local PostgreSQL cluster over a Unix
  socket, with no TCP listener; its exit trap stopped the server. This verifies
  local SQL behavior only and does not reconcile the hosted staging catalog.

PM reported directly observing these synthetic staging checks on 2026-10-15:

| Step              | Observation                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Private entry     | A synthetic 90.05 kg entry dated 2026-10-15 appeared on the author's Dashboard and was absent from the selected group's shared table. |
| Explicit share    | Sharing made that entry visible in the group; start 100 kg and target 90 kg produced 99.5% progress.                                  |
| Member account    | Another active member saw the shared entry without Edit/Delete; that member could edit only their own entries.                        |
| Author correction | Editing the original entry to 90.10 kg updated one shared row and showed 99% progress.                                                |

PM relayed the owner's report that unsharing retained the personal entry while
removing shared visibility, and that delete confirmation/deletion worked.
Those two results are **owner-reported**, not PM-observed or independently
repeated by this agent. No account identifiers, private notes, or screenshots
are included here. These observations do not establish refresh persistence,
multiple-group isolation, every negative authorization case, or Sunday results.

Dependency audit: #208 remains open for evidence reconciliation; #209–#211 and
#231 are closed. The latter issues' closure does not complete #212's connected
acceptance criteria. The revised #210 contract supersedes the older
group-only/both-destination wording: personal canonical entry, optional explicit
shares to one or more groups, none selected by default.

The earlier evidence record below names an older candidate. Subsequent
Dashboard/personal-chart and Group-chart/history changes in PRs #276/#277 mean
its unchanged-UI rationale cannot cover those changed surfaces. Preserve
earlier evidence for genuinely unchanged authorization and sharing behavior.

#### Next owner checklist

1. With a disposable entry and two eligible groups, share to both, refresh,
   switch accounts, then remove just one share. Confirm the personal entry and
   remaining group share survive, and notes remain author-only.
2. On approved disposable records, make a late/corrected entry and verify the
   current Group chart/table and provisional/final Sunday outcomes, including
   agreed partial-week and tie behavior. A weekday completion percentage does
   not establish Sunday ranking correctness.
3. Reconcile uncovered outsider, withdrawn, unauthenticated, cross-group and
   inappropriate-owner RPC denials with existing SQL evidence. Arrange the
   outstanding read-only staging schema/grant/migration-history audit, accounting
   for manually applied migrations. No authenticated database connection was
   available to this agent in this update; no ledger repair is proposed.

The owner performs interactive account-switch/save/edit/delete tests personally.
Record exact candidate, staging project, actor, expected/actual result and
redacted evidence; do not request credentials. Production configuration,
recovery and post-deploy smoke/disable planning remain separately gated.

#### Proposed #248 follow-ups (planning only)

No existing issue explicitly covers the newly approved combined views/public
shell. #252/#254/#255 cover the previous tabbed workspaces; #274/#275 cover their
visual refinement. Propose these scoped successors for PM tracking before code:

- **17.7 — Share the visual shell across public and protected routes.** Keep a
  persistent desktop left sidebar across Dashboard and Group, with accessible
  mobile navigation. Match Login/Register dark styling, branding, typography,
  controls and spacing. Signed-out navigation contains public destinations;
  no signed-in account controls or protected actions. Preserve redirects,
  authentication, focus and unsaved-navigation guards. Depends on the accepted
  #274/#275 visual direction and #255 routing contracts.
- **17.8 — Combine Dashboard into one personal view.** Remove its
  Overview/Progress split and duplicate metric/chart/history sections; retain
  one canonical recording flow, personal history/edit/delete, own goals and
  reached milestones. Preserve old tab URLs/anchors through compatibility
  routing. Depends on 17.7; references #252/#274.
- **17.9 — Combine Group into one selected-group view.** Remove its
  Overview/Progress split and duplicate metrics/chart/history, preserving member
  tabs, exact shared-history meaning, Sunday results, self-only target actions
  and selected-group privacy. Depends on 17.7 and accepted 17.8; references
  #253/#254/#256/#257/#275. Re-run the affected #207/#212 checks on the resulting
  final candidate before #247 resumes.

These are proposals, not created tickets or implementation authorization.

### Earlier candidate record (historical; superseded above)

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

# 16.5 — Connected sharing release gate status

## Release preparation — 2026-10-21

The release candidate integrates staging `1cf5f0d647360ebea1e310f80a0aac366968e749`
with main `78b347db03d65dc4535de232f15c1c97809f3e87`, preserving main-only
PR #296. This section supersedes older operational blockers below. Preparing
the PR does not authorize its merge, hosted SQL, or deployment.

PM reports successful Production catalog and aggregate preflight in READ ONLY
transactions ending ROLLBACK: five public tables, 40 columns (8 + 11 + 10 + 4 + 7),
30 constraints, 14 indexes, 15 policies, two non-internal triggers, and ten
public routines. All five tables have RLS enabled. The local five-migration
baseline has the same table/routine names and these catalog counts. This
summary supports baseline shape, not complete definition/ACL equivalence or
proof of applied migration versions. The migration ledger is absent; no
ledger repair is authorized. Canonical personal tables are absent. Nine legacy
rows have no orphan participants, missing profiles/auth users, or duplicate
user/date groups. Legacy authenticated INSERT/UPDATE remain effective; the
write fence has not been applied to Production.

On the exact staging tree above, the isolated PostgreSQL 16.12 rehearsal
applied the five baseline migrations, seeded synthetic legacy rows, applied the
legacy-write fence, then applied all twelve pending migrations. Source rows,
canonical ownership/date/weight/note/timestamps and provenance were preserved;
private rows stayed unshared and explicit shares stayed source-group-only.
The fence survived all twelve files, stale-client INSERT/UPDATE failed,
legacy SELECT/DELETE remained, and canonical save succeeded. The grant/RLS
audit and 86 authorization checks passed. The #310 catalog query executed on
local baseline/final schemas with the ledger absent, and on the final schema
with a synthetic ledger present; all runs were READ ONLY and rolled back.
PM also reports successful #310 execution on actual Production. Local
synthetic behavior and PM-reported Production read-only observations remain
separate evidence; no Production migration or cutover has been executed.

The separate CLI execution-method rehearsal also passed with installed
Supabase CLI 2.119.0 against a fresh local synthetic five-file baseline. The
supported `migration repair --status applied` recorded only the five baseline
versions; `migration list` showed those five applied and exactly twelve pending,
and `db push --dry-run` listed the expected twelve files in order. Before/after
public-schema dumps, including synthetic data and ACLs, matched after removing
only pg_dump's randomized restrict tokens. Both disposable local servers were
stopped. This validates the local CLI method; it does not authorize or perform
Production ledger repair.

The owner's limited-pilot backup/restore waiver remains in force under the
[recovery runbook](production-backup-restore-rehearsal.md); no backup or restore
is claimed. The reviewed pause/recovery proposal is also checked in. Current
Supabase incident scope, as checked by PM, concerns Management API project
lifecycle operations; Postgres, Data APIs and Auth are not listed as affected.
It does not block PR preparation. Production migration-history review,
hosted operation approvals, current service health and release acceptance
remain gates before any separately approved cutover, main merge or deployment.

## Earlier status — superseded by the release preparation record above

As of 2026-10-21, issue #212 remains **OPEN / NOT READY FOR PRODUCTION
RELEASE**. The latest staging commit is
`c561477de2ceda91c42fd6ac3398472a76babe6e` (PR #307), and its Vercel status
is successful. GitHub's commit-run lookup returned no workflow run for this
merge commit; the Quality workflows passed on the constituent PR heads
through #307.

Compared with the app tree accepted at `d24a593`, the intervening work is
scoped: PR #303 adds local Data API grant-audit tests and release docs; PR #304
refreshes this status doc; PR #305 changes only the legacy
`DailyWeighInFormPage` stale-write error response and adds local cutover tests;
PRs #306 and #307 update the owner-only recovery/cutover documentation. No
canonical personal-sharing, group-projection, chart, or Sunday-result code
changed. The one app behavior delta is covered by the passing local PR #305
tests, but its SQL fence has not been executed in staging, so the stale-client
message has not been observed against a fenced staging database. That
operational acceptance remains under #247 and must not be inferred from local
tests or a successful Vercel deployment.

Issue #207 is **CLOSED / COMPLETED**. Its authoritative completion record says
all six acceptance criteria were satisfied on the application tree at
`d24a593`, including responsive/mobile, keyboard/accessibility, and
loading/empty/error-state evidence. Those connected results remain applicable
to the unchanged canonical personal/group flows on `c561477`; do not repeat
the owner/member/outsider or Sunday-result journeys. The accessible-name concern was separately
corrected as a false alarm: Profile and Log out have accessible names, keyboard
focus reaches both, and Escape closes the menu. Reuse the evidence recorded in
[#207](https://github.com/johnciuverca/slimpossible-app/issues/207) and its
linked comments; do not repeat checks for the documentation/test-only PRs
#303, #304, #306, or #307. PR #305's isolated legacy-client error branch has
local coverage but no connected test, pending the separately gated write
fence.

The five core sharing, privacy, history, and Sunday-result criteria in #212
are recorded complete on candidate `911808aba56f9f8ed82f97306aa4fabc927ba79c`
(same canonical app behavior as `d24a593`; PR #301 changed test expectations
only). The exact prior staging project/candidates and redacted results are
recorded in #207/#212. The current candidate `c561477` has Vercel success, but
has not received a new connected flow walkthrough. This does not constitute
final owner sign-off. Production promotion remains separately gated by #247.
No production configuration, database, backup, migration, or deployment was
changed or authorized by this status update.

## Current remaining gates

- **Completed from existing evidence:** mobile/responsive, accessibility,
  keyboard/focus, and general loading/empty/error review under #207; the five
  core #212 sharing/privacy/history/Sunday criteria; read-only environment and
  Auth-redirect separation review under #247; migration ordering and stop/hold
  rules documented in the #247 runbook. Do not rerun completed UI, SQL/RPC,
  sharing, account-switch, or Sunday-result flows.
- **Still needs owner action:** record explicit owner sign-off for #212; it is
  not inferred from #207 closure, merges, or passing tests. The #212 checklist
  item combining release review with exact-candidate evidence should retain the
  tested candidate `911808a` and identify current staging `c561477` as
  deployment-verified but not newly connected-walkthrough-tested.
- **Current-candidate limitation:** PR #305's legacy-client `42501` refresh
  message has local tests, but no connected observation on a staging database
  with the manual fence applied. Do not apply the fence for this review. If
  stale-client behavior is required for promotion, verify it only in #247's
  separately approved cutover/rehearsal sequence.
- For any later production promotion under #247, first obtain a private backup
  and successful isolated restore proof; rehearse the migration baseline and
  exact pending set; resolve and test the stale-client legacy-write control;
  and repeat the privacy-safe production catalog/data preflight immediately
  before an approved window. Production currently has no migration ledger;
  catalog equivalence is not proof of applied migration history. The proposed
  sequence is five catalog-reconciled baseline versions followed by twelve
  timestamp-ordered migrations, and has not been executed on production.
- **Still open under #247, not a missing #212 feature:** fresh production
  backup plus isolated restore proof; production migration-ledger/schema
  reconciliation and rehearsal; and owner approval for exact SQL, main merge,
  and deployment operations. The runbook documents post-deploy smoke order and
  stop conditions, but no executed production smoke exists. An owner-reviewed
  feature-disable trigger and forward-compatible recovery/compatibility plan
  is still missing; several migrations have no safe inverse, so do not
  automatically run inverse migrations after failure.

## Historical status snapshot — 2026-10-15 (superseded)

The sections below preserve earlier evidence and planning notes. Their
candidate SHAs, open/closed issue descriptions, and proposed next steps are
historical unless explicitly carried forward by the current status above or
the live issue records.

### Historical staging snapshot

The staging ref was then recorded as
`d8b984c62776dfac1162a11978b3d94b90b666de` (merge of PR #286). It includes
these later workspace PRs:

- [PR #284](https://github.com/johnciuverca/slimpossible-app/pull/284),
  merged as `83404a9f9a28cf9637e99471492029f9abacba7f`: shared layout for
  Dashboard, Group, Login and Register (issue #281 is closed).
- [PR #285](https://github.com/johnciuverca/slimpossible-app/pull/285),
  merged as `de57e9cfa0b25b30f5d028d30ad255cd5b094a66`: one personal-only
  Dashboard view (issue #282 is closed).
- [PR #286](https://github.com/johnciuverca/slimpossible-app/pull/286),
  merged as `d8b984c62776dfac1162a11978b3d94b90b666de`: one selected-group
  view (issue #283 remains open).

These changes postdate the connected observations recorded below. Their
automated checks and previews are not connected owner acceptance of `d8b984c`.
In particular, the revised Dashboard/account shell and combined Group view,
including the Create/Join popover and refresh behavior, have not been connected-
tested as part of the observations below. Do not infer that #207, #212, #155,
or issue #283 is accepted or complete from these merges.

### Historical connected evidence and inherited automated checks

### Historical connected observations (2026-10-15; earlier candidate)

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

The observations in this section were made on the candidate identified below,
not on current staging `d8b984c`. They remain historical evidence for the
specific journeys and actor/data conditions recorded here. They do not cover
the newer workspace surfaces in PRs #284–#286 described above. Existing
authorization and sharing evidence may be retained only for the exact unchanged
backend behavior it exercised; it does not certify the newer UI or current
connected end-to-end flows.

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

#### #248 workspace sequence — current disposition

The October 15 owner-approved follow-up sequence is no longer a proposal:

| Issue          | Scope                             | Verified disposition                                             |
| -------------- | --------------------------------- | ---------------------------------------------------------------- |
| #281 / PR #284 | 17.7 shared workspace layout      | PR #284 merged to staging as `83404a9`; issue #281 closed.       |
| #282 / PR #285 | 17.8 combined personal Dashboard  | PR #285 merged to staging as `de57e9c`; issue #282 closed.       |
| #283 / PR #286 | 17.9 combined selected-group view | PR #286 merged to staging as `d8b984c`; issue #283 remains open. |

The merged PRs implement these workspace changes, but their merge and
automated checks do not satisfy connected acceptance gates. Per #248, rerun
the affected #207/#212 acceptance on the final candidate before #247 resumes.
Keep #155 as a separate open Chapter 14 release gate; do not infer its
completion from the Chapter 17 workspace PRs. #247 remains **BLOCKED / QUEUED**
until the pre-sync roadmap and connected gates are accepted.

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

### Evidence recorded in the historical snapshot

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

### Historical remaining-acceptance snapshot (superseded)

| Area                             | Existing evidence                                                                                                                                                                                                                                                                                                                                                         | Remaining action                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Optional multiple-group sharing  | One explicitly selected group was connected-tested; local tests cover optional choices, edits, refresh, and account isolation. The owner accepted the targeted Goals preview.                                                                                                                                                                                             | Connected-test the still-missing multiple-eligible-group path and confirm only selected groups receive date/weight, never the note. Do not replay the accepted one-group path solely because the SHA changed.                                                                                                                                                                                                      |
| No-share and membership/privacy  | Personal-only and one-group journeys were connected-tested. A member and unrelated signed-in reader were checked in the UI. Local authorization tests cover anonymous/withdrawn cases. The staging role/GUC probe checked the canonical RPC fingerprint, catalog/ACL/self-conditions, and denied sessionless and unrelated authenticated caller simulations with `42501`. | Reconcile the specific #212 direct server/RPC denial cases against the existing SQL and local tests; execute only any uncovered case, such as inappropriate owner access. Role/GUC evidence is database-side, not signed-JWT/HTTP evidence; JWT/HTTP is not a new requirement imposed here.                                                                                                                        |
| Group charts and Sunday outcomes | Local chart/history tests cover corrections, late baselines, unsharing, deletion, partial participation, and ties; earlier connected read-only Group checks remain applicable because those paths did not change.                                                                                                                                                         | Connected evidence is still needed for a late/corrected entry updating the relevant chart/table and provisional/final Sunday results, including agreed partial-week and tie behavior.                                                                                                                                                                                                                              |
| Accessibility and failure states | Earlier connected 390px keyboard/navigation observations and automated failure/empty/loading coverage apply only to the surfaces and candidate they exercised. PRs #284–#286 changed the workspace shell and layouts after those observations.                                                                                                                            | During connected acceptance on `d8b984c`, verify responsive layout, keyboard/focus, direct routes, and loading/empty/error behavior on affected Dashboard and Group surfaces. Record actual results; do not reuse prior screen evidence as a pass for these changes.                                                                                                                                               |
| Migration/configuration/recovery | The source migration order and selected guarded rollback files are inventoried in [release workflow](release-workflow.md). The staging backend assignment and a read-only catalog/ACL probe are already in #268 evidence.                                                                                                                                                 | Reconcile the actual staging schema/grants with the approved migration set and available migration-history records, accounting for manually applied migrations. Use read-only evidence; do not repair the ledger or rerun SQL. Production configuration, recoverability, and post-deploy smoke/disable planning remain a separate owner-approved production gate. No backend URL reconfirmation is requested here. |

The 2026-10-15 status review made no hosted writes, account changes, migrations,
grant/policy changes, environment changes, production deployments, or issue
closures. Its issue dispositions and blocker table above are historical and
superseded by the current status at the top of this document and the linked
live issue records. Production release remains a separate owner-approved action
after its gates are complete.

## Historical snapshot preserved from main PR #296

The following 2026-10-19 snapshot is retained as historical evidence. Its
remaining-gate statements are superseded by the current status above and later
owner/PM observations; they do not reopen completed acceptance checks.

Status snapshot recorded 2026-10-19 for staging candidate
`00fcf280bd3be0d54ea3497679d23e80633207d4`. This is partial evidence for
issues #207, #212, and #155. It is not production approval, a hosted migration
attestation, or authorization to close any issue.

## Verified on this candidate

- **#212 connected sharing/privacy flow: PASS for the observed path.** Using a
  disposable test record, group-only sharing was saved, then edited to share
  with both selected groups. Both groups showed the entry without its private
  note. The entry was deleted, and refreshing both groups confirmed it was
  absent. Existing records remained; no production data was involved.
- **Signed-out route: PASS for `/dashboard` only.** Incognito direct navigation
  redirected to the app's `/login` route. Other protected routes and the wider
  navigation/reload matrix were not established by this observation.
- **Local SQL/migration harness: PASS, local only.** Run from this exact
  candidate, it applied the timestamp-ordered migration set and passed 17
  permission cases and 15 group-history projection cases. This does not prove
  that the hosted staging database has the same schema, grants, or migration
  ledger.

## Still not executed

| Gate                                                                               | Status       |
| ---------------------------------------------------------------------------------- | ------------ |
| #155 solo registration, confirmation, sign-in, and saved solo progress             | NOT EXECUTED |
| #155 group invitation acceptance by a second user                                  | NOT EXECUTED |
| #155 valid mailbox recovery/reset and used/expired provider links                  | NOT EXECUTED |
| Recovery/network failure induced against the connected provider                    | NOT EXECUTED |
| Two-member Sunday ranking and late/corrected-record result after refresh           | NOT EXECUTED |
| Full #207 protected-route, loading/empty/error, and membership matrix              | NOT EXECUTED |
| Mobile viewport and keyboard/focus acceptance matrix                               | NOT EXECUTED |
| Read-only reconciliation of hosted migration history/schema against this candidate | NOT EXECUTED |

Local unit, component, E2E-fallback, and SQL tests remain separate from those
connected journeys. The local SQL results are summarized above; they must not
be presented as hosted database evidence.

## Migration and rollback inventory

The exact candidate contains 17 timestamped migration files. The full
candidate-specific list and the eight checked-in rollback scripts are recorded
in the [release workflow](release-workflow.md) and
[staging setup handoff](supabase-staging-setup.md). Rollback scripts exist for
only a subset; their presence is not an instruction to execute them. No
statement is made here about which migrations the hosted staging ledger has
recorded. Production configuration, migrations, deployment, and rollback
remain separate owner-approved gates.

This status snapshot changes no staging or production settings/data and does
not close #207, #212, or #155. The remaining connected gates above must be
completed and reviewed before considering live release sync.

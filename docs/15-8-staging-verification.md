# 15.8 — Redesign verification on staging (#207)

## Candidate and evidence date

- Date: 2026-10-13 (Europe/Bucharest).
- Staging candidate: `a2b524f33558f25744b5624580eac224943eaf24`, the merge of
  PR #267. Its Git tree is identical to reviewed PR head
  `0cc9846429f8cf6db456dd59bca716c19af316b0`.
- GitHub's Vercel status for the staging merge commit is **success**; deployment
  detail ID: `E4nSwMkXrJ7NZPByKMESA6KdkziA`.
- The repository's documented stable staging hostname,
  `https://slimpossible-app-git-staging-cvc10.vercel.app`, was opened
  unauthenticated at 1280×900. It returned Vercel's login/protection page,
  not the Slimpossible app. This is specific to that browser/session, not a
  project-wide protection finding. The PM subsequently used their existing
  authenticated in-app browser (no credentials transferred) and confirmed the
  staging app loaded. In a follow-up read-only check, PM independently
  confirmed the Vercel deployment UI for deployment
  `E4nSwMkXrJ7NZPByKMESA6KdkziA` reports project `slimpossible-app`, Preview
  environment, source branch `staging`, and exact source commit
  `a2b524f33558f25744b5624580eac224943eaf24` (the merge of PR #267). The
  assigned stable staging domain matches the hostname above. This maps the
  reported owner browser observations to the candidate. Before the synthetic
  write below, PM also verified in owner-managed branch-specific Preview
  configuration that the staging runtime `VITE_SUPABASE_URL` matched the known
  staging backend. No URL, key, or other environment value was copied into
  this record. This confirms the tested Preview's backend assignment, not a
  general server-side authorization or privacy audit.

## Automated evidence on the exact staging tree

All local checks ran from the clean `codex/15-8-staging-verification` branch
at the candidate SHA above. Fixtures and intercepted RPCs are synthetic/local.

| Check                  | Result                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run lint`         | PASS                                                                                                |
| `npm run typecheck`    | PASS                                                                                                |
| `npm run format:check` | PASS                                                                                                |
| `npm test`             | PASS — 517 tests across 85 files                                                                    |
| `npm run build`        | PASS — existing large-bundle warning only                                                           |
| `npm run test:e2e`     | PASS — 97 application and 25 Group tests; local Vite/Chromium required permitted loopback execution |
| `git diff --check`     | PASS                                                                                                |

Coverage relevant to #207 includes signed-out protected-route redirects and
public registration/login states; no-challenge Dashboard and private logging;
owner and active-member actions; personal Progress/Goals; selected Group
context; direct routes, refresh and account switching; distinct loading,
empty and error states; keyboard focus/activation and 390px/desktop layout.
Group tests use synthetic authorized projections to check member-specific
target controls, read-only peer views, reached milestones, selected-group
history, and failure/empty states. They do not establish connected account or
database behavior.

## Current data and privacy contract

The original #207's six-route checklist and its pre-Chapter-16 statement are
historical; they do not override the currently accepted architecture and
Chapter-16 disclosure. Per the owner's current #248 direction, primary
workspaces are Dashboard and Group. Dashboard Progress/Goals remains
personal-only. Group may show the accepted selected-group projection for
currently eligible authenticated members: permitted group results/history,
explicitly shared entries, disclosed enrollment start/current target and
completion progress, and earned target milestones. It must not expose private
notes, personal-only or unshared entries, raw IDs, or another group's data.
The tests above exercise synthetic projections; no live payload was inspected
for this candidate.

## Connected acceptance — PARTIAL; owner journeys remain open

| Journey                                                      | Automated evidence                                            | Connected result on `a2b524f`                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Owner, joined member, outsider/no-challenge                  | Synthetic route, role, permission, and metric coverage passes | PARTIAL — owner/member and signed-in unrelated-account UI paths run; anonymous/withdrawn and server negatives NOT EXECUTED       |
| Dashboard, Progress/Goals, selected Group; save/edit/refresh | Synthetic UI/repository/E2E coverage passes                   | PARTIAL — owner synthetic save/edit/reload/cleanup passed; member selected-Group read-only passed; broader workflows remain open |
| Logout/login and account switching                           | Injected auth and synthetic account-switch coverage passes    | NOT EXECUTED                                                                                                                     |
| Desktop and 390px visual/keyboard/labels                     | Automated desktop/mobile/keyboard assertions pass             | PARTIAL — owner read-only 390×844/keyboard pass; desktop visual and full accessibility audit not recorded                        |
| Actual staging permissions and returned data                 | Authorization contracts and mocked RPC privacy tests pass     | PARTIAL — member/private-context and cross-group UI denials observed; no direct server-negative test                             |

The PM's read-only authenticated observation found the primary Dashboard/Group
navigation and personal Overview working, and the selected authorized Group
summary loading with owner-management actions. On the first Dashboard load,
invitation choices showed a load error and “Invite people” was disabled. On one
subsequent reopen/retry, the personal Dashboard loaded and the Invite people
link was enabled; the error did not recur. No record was created or changed;
no private values, identities, or notes are included here. The exact initial
failing request/status was not captured, so the transient cause remains
unknown. No code fix is justified by this observation. Unrelated outsider
access, auth switching, signup/recovery, and server-side privacy negatives
remain outstanding.

In a follow-up read-only owner-session check at 390×844, Dashboard Overview,
personal chart, and authorized Invite people link loaded. Document width stayed
390px. ArrowRight moved from Overview to Progress with selected tab and focus;
personal history and Goals loaded. Enter on Group navigation opened the
authorized selected Group Overview. Space activated “Progress & history” and
retained focus; group progress, milestones, shared chart, and table loaded.
Document width remained 390px; only the comparison chart and shared table had
their contained horizontal overflow. Accessibility inspection found named
record/management/edit controls and read-only peer controls in this owner
view. The temporary viewport override was restored. No record was changed in
this read-only pass.
This is not a complete contrast/visual polish or accessibility audit. A
desktop-size connected visual pass and direct hard-refresh/deep-link checks are
not evidenced. No screenshot or private value was retained.

## Authorized synthetic save/edit check

On the same mapped Preview candidate, PM confirmed the staging runtime backend
assignment before writing. Using the already-signed-in owner account and an
unused date in the existing staging test account's personal log, PM saved one
fictional personal-only entry with a fictional note and no challenge context;
every group-share option remained unchecked.
Saving succeeded. During edit, a paste appended to the prior numeric value and
was blocked by finite-number validation without persisting; selecting all and
replacing the field succeeded. Editing the same date saved successfully. A
hard reload showed exactly one entry for that date with the updated content.
The selected Group Progress/History view loaded and did not show this
personal-only fixture's date, value, or note. This confirms the exercised
owner UI path kept this fixture unshared; it is not evidence of server-side
authorization against another identity or inspection of an RPC payload.
PM deleted only the authorized synthetic fixture through the app, confirmed
its absence after a hard reload, verified the pre-existing personal entries
remained, and returned to Dashboard Overview. No existing record, share,
invitation, account, SQL, or production setting was changed. No raw values or
private text are retained in this report.

## Joined-member read-only acceptance

After the owner signed into the existing staging member test account, PM
reloaded the mapped candidate without changing records. Dashboard Overview and
the member's own profile/history loaded, with no owner-management links. The
selected authorized Group Progress/shared table loaded. Edit/delete actions
were available only for the signed-in member's own shared rows; peer-owner rows
had no edit/delete actions, and group-management links were absent. A known
owner-private personal challenge was unavailable when opened through Dashboard
Progress/Goals, while the member's own history remained available. A direct
Group URL for that private challenge displayed an unavailable notice and no
shared table. Known private-note markers from the two personal views were not
present in the selected Group view. Refreshing the authorized Group view
preserved the read-only result. No account logout or record write occurred.

This is a connected member-UI/read-only context-denial result, not a direct
HTTP/RPC authorization test, payload inspection, or proof for unrelated
outsiders. The account previously described by a UI/display label resembling
“outsider” is actually an active member of the tested Group; it is not counted
as an outsider.

## Signed-in unrelated-account read-only check

Using a different already-existing staging account, PM confirmed its own
authorized Group remained available, then opened a direct Group URL for the
tested account's Group. The app displayed that the selected challenge was
unavailable and showed no shared table. A hard refresh preserved the denial;
PM then returned to the account's own authorized Group. No records were read
out, changed, or copied into the report. This is a signed-in cross-group UI
denial only; it does not prove direct HTTP/RPC authorization or cover
anonymous/withdrawn accounts. The separate account's identity is not recorded.

Prior evidence does not transfer automatically: #155's existing partial report
is for the older `76312b6` candidate; #212/#211 evidence is for earlier
Chapter-16 candidates. #207 has no earlier evidence comments. Keep #207, #212,
and #155 open until coordinated exact-candidate observations are recorded; do
not close them from this local/CI/deployment result. Issue #247 remains paused.

## 2026-10-14 connected sharing and database verification

The owner reports completing the four-step group-sharing walkthrough. PM
independently repeated the relevant flow on the current staging application
candidate, e181f8099611d4cf8e1b8ff91b43e072a7a6f5df, which is the test-only
PR #270 merge; the application source is unchanged from the earlier
a2b524f33558f25744b5624580eac224943eaf24 candidate. This follow-up must
not be read as evidence that all #212 criteria are complete.

Using an existing writer account, PM saved one fictional personal entry and
explicitly selected one Group share. In that selected Group, the row appeared
without its private note. In the existing member account, the shared row
remained visible after reload; the private note and edit/delete controls were
absent, and the member's own personal history remained separate. Back in the
writer account, PM removed the Group share and confirmed the row disappeared
from Group while remaining in Personal Progress. PM then deleted only this
fictional fixture through the app; a hard reload confirmed it was gone and the
three pre-existing personal records remained. No existing records, milestones,
targets, shares, accounts, or production settings were changed. The member was
not separately rechecked after the writer unshared the row. No fixture remains.
The owner also reports their own four-step check passed.

A reviewed read-only SQL role/claim probe also ran on staging. The database
reported PostgreSQL 17.6, and its get_group_weigh_in_history(uuid)
function-definition fingerprint matched the canonical PostgreSQL 16 local
baseline. The exact reviewed script had SHA-256
94323052fbdb1ba1cff6bbcb70a646bbc06b4e97f19e75ee2f356d088cb61bea.
The catalog, function-security/ACL, cohort, and auth.uid() self-checks passed;
sessionless and unrelated authenticated caller simulations were denied with
SQLSTATE 42501. The batch used BEGIN READ ONLY and ROLLBACK; it returned no
personal rows and made no persistent database changes. This is database
role/GUC simulation, not signed PostgREST JWT/HTTP proof. It does not cover
anonymous or withdrawn-account HTTP requests or the target-milestone RPC.

### Reproducible Dashboard Goals observation

PM reproduced the “Reached target history is unavailable right now” message on
the selected Group Goal both before and after a hard reload; other personal
history, goal context, and target controls loaded. No response payload or
private values were inspected.

Static path review found a plausible UI contract mismatch: DashboardGoals
calls the participant repository's listOwnGroupTargetMilestones, which calls
list_my_group_target_milestones. The shared mapList helper represents a valid
zero-row result as state: 'empty', while this component currently treats only
state: 'success' as ready and maps empty to the unavailable state. Thus a
valid account with no reached-target history can see an error message. The
live RPC result was not inspected, so this is a code-supported likely
explanation, not a confirmed cause; hosted milestone-RPC schema/grants were
not independently probed. No speculative app change was made. Track any fix
as a focused issue/PR with explicit empty, non-empty, and denied-result tests.

## Remaining verification

This follow-up adds connected evidence for one explicit Group share, member
read-only visibility, unsharing, and cleanup; it does not complete #207, #212,
or #155. Remaining #212 scope includes no-share and multiple-selected-group
save/edit/refresh/account-switch paths, group chart/table and Sunday
provisional/final recomputation after late/corrected data (including partial
weeks and ties), remaining privacy/auth cases, and release configuration,
migration/rollback, post-deploy smoke/disable, and accessibility checks. The
member was not rechecked after unsharing. Anonymous and withdrawn-user HTTP
negative tests remain unexecuted. The staging SQL probe described above is not
signed-JWT/HTTP evidence.

The Dashboard Goals unavailable message is reproducible; its exact live RPC
outcome remains unknown. A bounded next step is one focused UI/repository test
for valid empty versus non-empty versus denied milestone results, then a
separate tracked fix only if PM approves the evidence-based diagnosis. No
hosted policy/migration/grant change is proposed. Keep #207, #212, and #155
open; #247 remains paused.

No new accounts, hosted writes, migrations, production changes, issue closure,
or promotion to main were performed. The only hosted SQL was the
read-only BEGIN READ ONLY ... ROLLBACK verification above.

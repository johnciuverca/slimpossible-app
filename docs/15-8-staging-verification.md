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

| Journey                                                      | Automated evidence                                            | Connected result on `a2b524f`                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Owner, joined member, outsider/no-challenge                  | Synthetic route, role, permission, and metric coverage passes | NOT EXECUTED — member and outsider journeys remain open                                                   |
| Dashboard, Progress/Goals, selected Group; save/edit/refresh | Synthetic UI/repository/E2E coverage passes                   | PARTIAL — owner synthetic personal-only save/edit/reload/cleanup passed; broader workflows remain open    |
| Logout/login and account switching                           | Injected auth and synthetic account-switch coverage passes    | NOT EXECUTED                                                                                              |
| Desktop and 390px visual/keyboard/labels                     | Automated desktop/mobile/keyboard assertions pass             | PARTIAL — owner read-only 390×844/keyboard pass; desktop visual and full accessibility audit not recorded |
| Actual staging permissions and returned data                 | Authorization contracts and mocked RPC privacy tests pass     | PARTIAL — unshared fixture absent in owner Group view; no member/outsider or server-negative test         |

The PM's read-only authenticated observation found the primary Dashboard/Group
navigation and personal Overview working, and the selected authorized Group
summary loading with owner-management actions. On the first Dashboard load,
invitation choices showed a load error and “Invite people” was disabled. On one
subsequent reopen/retry, the personal Dashboard loaded and the Invite people
link was enabled; the error did not recur. No record was created or changed;
no private values, identities, or notes are included here. The exact initial
failing request/status was not captured, so the transient cause remains
unknown. No code fix is justified by this observation. Member/outsider access,
auth switching, signup/recovery, and server-side privacy negatives remain
outstanding.

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
unused date in an existing challenge, PM saved one fictional personal-only
entry with a fictional note; every group-share option remained unchecked.
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

Prior evidence does not transfer automatically: #155's existing partial report
is for the older `76312b6` candidate; #212/#211 evidence is for earlier
Chapter-16 candidates. #207 has no earlier evidence comments. Keep #207, #212,
and #155 open until coordinated exact-candidate observations are recorded; do
not close them from this local/CI/deployment result. Issue #247 remains paused.

## Remaining verification

Vercel source SHA/project/domain and the staging Preview backend assignment
were verified as described above. Remaining gates are a desktop-size connected
visual and direct hard-refresh/deep-link pass; member/outsider and auth-switch
checks only if authorized sessions already exist; and server-side privacy
negatives. Do not create accounts. Group-sharing write behavior remains
untested. If the invitation-choice error returns, capture only request
category/status/error code; do not inspect or share payload values. Full
contrast/accessibility review also remains open. Return redacted
PASS/FAIL/BLOCKED observations. Do not transfer credentials, identities,
private notes, raw weights, screenshots containing personal data, or
environment-variable values. No new accounts, hosted SQL, production
changes, issue closure, or promotion to `main` were performed here.

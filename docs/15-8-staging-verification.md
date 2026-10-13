# 15.8 — Redesign verification on staging (#207)

## Candidate and evidence date

- Date: 2026-10-13 (Europe/Bucharest).
- Staging candidate: `a2b524f33558f25744b5624580eac224943eaf24`, the merge of
  PR #267. Its Git tree is identical to reviewed PR head
  `0cc9846429f8cf6db456dd59bca716c19af316b0`.
- GitHub's Vercel status for the staging merge commit is **success**; deployment
  detail ID: `E4nSwMkXrJ7NZPByKMESA6KdkziA`. This is deployment health, not
  proof of authenticated app behavior or environment-variable targeting.
- The repository's documented stable staging hostname,
  `https://slimpossible-app-git-staging-cvc10.vercel.app`, was opened
  unauthenticated at 1280×900. It returned Vercel's login/protection page,
  not the Slimpossible app. This is specific to that browser/session, not a
  project-wide protection finding. The PM subsequently used their existing
  authenticated in-app browser (no credentials transferred) and confirmed the
  staging app loaded. The exact deployed SHA was not independently confirmed
  during that observation.

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

| Journey                                                      | Automated evidence                                            | Connected result on `a2b524f`                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Owner, joined member, outsider/no-challenge                  | Synthetic route, role, permission, and metric coverage passes | NOT EXECUTED — member and outsider journeys remain open                                  |
| Dashboard, Progress/Goals, selected Group; save/edit/refresh | Synthetic UI/repository/E2E coverage passes                   | PARTIAL — Dashboard/Group viewed read-only; save/edit/refresh not run                    |
| Logout/login and account switching                           | Injected auth and synthetic account-switch coverage passes    | NOT EXECUTED                                                                             |
| Desktop and 390px visual/keyboard/labels                     | Automated desktop/mobile/keyboard assertions pass             | PARTIAL — PM saw Dashboard/Group at unspecified desktop size; 390px/keyboard not checked |
| Actual staging permissions and returned data                 | Authorization contracts and mocked RPC privacy tests pass     | PARTIAL — selected Group summary loaded; payload/privacy negatives not inspected         |

The PM's read-only authenticated observation found the primary Dashboard/Group
navigation and personal Overview working, and the selected authorized Group
summary loading with owner-management actions. On the first Dashboard load,
invitation choices showed a load error and “Invite people” was disabled. No
record was created or changed; no private values, identities, or notes are
included here. The underlying Dashboard workspace loads challenge visibility
and the signed-in user's participant rows together; either request can produce
the invitation-choice error. Since the Group context later loaded, a failure
of the participant-list request is a plausible explanation, but the exact
failing request and error were not captured. This is a diagnosis to verify, not
a confirmed root cause. Retry/recovery, member/outsider access, save/edit,
responsive 390px, and keyboard checks remain outstanding.

Prior evidence does not transfer automatically: #155's existing partial report
is for the older `76312b6` candidate; #212/#211 evidence is for earlier
Chapter-16 candidates. #207 has no earlier evidence comments. Keep #207, #212,
and #155 open until coordinated exact-candidate observations are recorded; do
not close them from this local/CI/deployment result. Issue #247 remains paused.

## Remaining verification

Continue in the already-authorized staging browser/session when available.
Confirm the deployed SHA and dedicated non-production project, then repeat the
Dashboard invitation-choice load once while observing only request outcome and
status (no payload values); determine whether the challenge or participant
request fails and whether refresh recovers. Complete desktop/390px, keyboard,
member/outsider, and authorized save/edit/refresh checks with disposable
non-sensitive records. Return redacted PASS/FAIL/BLOCKED observations. Do not
transfer credentials, identities, private notes, raw weights, screenshots
containing personal data, or environment-variable values. No new accounts,
hosted SQL, production changes, issue closure, or promotion to `main` were
performed here.

# 14.7 — First connected app release checklist

This is a release gate and owner handoff, not approval to deploy or activate
production. No production settings, data, or deployment are changed by this
checklist. Do not treat local tests or mock responses as staging evidence.

## Current evidence and blockers

- Release-gate evidence was reconciled on 2026-10-19 against staging candidate
  `00fcf280bd3be0d54ea3497679d23e80633207d4` (PR #295 merge).
- A disposable local PostgreSQL harness run from that exact candidate applied
  the timestamp-ordered migration set and passed 17 permission cases and 15
  group-history projection cases. This is local SQL evidence only; it does not
  attest to the hosted staging migration ledger or schema.
- On the same staging candidate, the connected #212 disposable-record flow
  passed for group-only sharing, then sharing to both selected groups, editing,
  and deletion. The private note was absent from group views, and the deleted
  row remained absent after refreshing both groups. No existing user row or
  production data was changed.
- In Incognito, opening `/dashboard` directly redirected to the app's `/login`
  route. This verifies that route only; it does not complete the wider direct
  link/reload, account, or protected-data matrix.
- Production activation, production migrations, and merge: **NOT PERFORMED**.

The release remains blocked. Registration, saved solo progress, invitation
acceptance, Sunday ranking and late-correction outcomes, recovery through a
real mailbox, induced live failures, and the mobile/keyboard matrix remain
**NOT EXECUTED**. The candidate migration inventory is recorded in the
[release workflow](release-workflow.md); no hosted migration-ledger
reconciliation is claimed. Never send credentials, populated environment
files, or real personal data in chat or this repository.

## Staging preflight — owner action

1. Provide the exact Vercel **Preview** URL for the reviewed candidate, and
   confirm in owner-managed settings that its `VITE_SUPABASE_URL` and public
   `VITE_SUPABASE_ANON_KEY` target the dedicated non-production project. Do not
   provide either value to the reviewer. Confirm the URL is not the production
   domain and that the database contains no real personal data.
2. Prepare two disposable test identities (A and B) and a mailbox the owner
   controls for confirmation/recovery links. Prepare a third disposable,
   unrelated identity only if the negative membership check cannot be shown
   using an anonymous session. Do not share passwords or mailbox contents.
3. Confirm Email Auth and exact preview-origin `/login` and
   `/reset-password` redirects are configured in the test project.
4. Have the owner apply and verify every checked-in migration in timestamp
   order, as listed in [the staging setup handoff](supabase-staging-setup.md).
   Confirm the project/environment label and migration filenames only; do not
   expose project IDs, credentials, keys, user IDs, or row data in this record.
5. Confirm the preview commit SHA equals the reviewed PR head before running
   the browser matrix. Record the exact SHA and test date in the redacted
   evidence table below.

## Browser acceptance matrix

Run with synthetic values only. Record each item as `PASS`, `FAIL`, or
`BLOCKED`; a planned step stays `NOT EXECUTED` until an owner-run observation
exists. Do not paste emails, invite tokens, raw weights, or private notes into
screenshots, logs, PRs, or this file.

| Journey                 | Required observation                                                                                                                                                                                                                                              | Result                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Solo registration       | A registers with the dedicated mailbox, confirms if required, signs in, and reaches the authenticated app. Verification returns safely to `/login`.                                                                                                               | NOT EXECUTED                                                                     |
| Solo saved progress     | A creates a challenge, explicitly enrolls, saves a synthetic weigh-in, refreshes, and sees saved progress after a fresh sign-in. Correcting the same date leaves one record.                                                                                      | NOT EXECUTED                                                                     |
| Recovery and errors     | Recovery confirmation does not reveal account existence; a valid dedicated recovery link resets the test password; expired/used links and simulated network failures show safe retry guidance.                                                                    | NOT EXECUTED                                                                     |
| Group invitation        | A creates a group challenge and invite; B opens the invite, authenticates, accepts, and appears as an active member only after acceptance.                                                                                                                        | NOT EXECUTED                                                                     |
| Group ranking and edits | A and B add synthetic Sunday records; the selected group's final Sunday ranking is correct. Late/corrected same-date records update the result after refresh, without duplicates.                                                                                 | NOT EXECUTED                                                                     |
| Membership and privacy  | Active members can see only the allowed group aggregate/display names. Invited-before-acceptance, signed-out/anonymous, and unrelated identities cannot read protected group data. No other member's raw weight/history/note appears in UI or group RPC response. | NOT EXECUTED — the #212 share/privacy path below is partial evidence only        |
| Direct links and reload | Direct `/progress?challenge=<selected-id>`, `/group?challenge=<selected-id>`, and invite links load the exact selected challenge; refresh preserves valid route context and signed-out protected navigation returns through login safely.                         | NOT EXECUTED — only the signed-out `/dashboard` → `/login` redirect was observed |
| Keyboard and mobile     | At a narrow mobile viewport, no clipped controls or horizontal page overflow; Tab order/focus is visible and primary links/forms/buttons work with Enter/Space. Repeat critical check on desktop.                                                                 | NOT EXECUTED                                                                     |

Existing automated tests exercise mocked auth/repository boundaries and local
browser behavior, including protected direct routes, mobile shell/enrollment
layout, keyboard activation, form errors, password recovery states, group
summary privacy, and selected challenge behavior. They are not live staging
verification. The browser acceptance results above must be recorded
independently.

The 2026-10-19 staging observations above are limited to the exact routes and
synthetic #212 record flow described. They do not establish signup, invite
acceptance, password recovery, Sunday ranking, mobile/keyboard, or induced
network-failure behavior.

Relevant suites include `src/pages/ChallengeSetupPage.test.tsx`,
`src/pages/ChallengeInvitesPage.test.tsx`,
`src/pages/InviteAcceptancePage.test.tsx`, `src/pages/AppPages.test.tsx`,
`src/data/supabase/repositories.test.ts`, the tests under `src/auth/`, and the
existing `e2e/` protected-route, deployment-route, password-recovery, mobile
shell, and keyboard-enrollment specs. `supabase/tests/rls_authorization.sql`,
`supabase/tests/challenge_invites_authorization.sql`, and the group progress
SQL harness are optional database-side checks; run them only in the approved
disposable non-production project under the owner-run procedure.

## Production configuration and migration gate

Only after staging evidence is reviewed and the PM/user separately approves a
production release:

1. Confirm the owner-managed Vercel production project remains connected to
   `main`, uses `npm run build`, and serves `dist/`. Verify the production
   origin and project identity in the owner's dashboard; do not infer either
   from a preview URL.
2. Owner configures production `VITE_SUPABASE_URL` and the provider's public
   anonymous/publishable browser key only in the intended Vercel environment.
   Configure the exact production Site URL and `/login` plus
   `/reset-password` redirects in Supabase Auth. Never put a service-role key,
   database password, or project token in a `VITE_` variable.
3. Review the migration state and schema backup/restore plan. Apply outstanding
   migrations through the owner's approved production change process, in
   timestamp order, separately from frontend deployment. Do not apply a
   migration merely because this PR merges.
4. Verify deployment build status and direct SPA routes (`/login`,
   `/challenge/setup`, `/progress`, `/group`) return the app shell. If an
   authenticated production write smoke test is explicitly approved, use only
   an owner-designated synthetic test account and planned cleanup; otherwise
   keep the production smoke read-only.
5. Record reviewed app SHA, deployment identifier, environment label,
   migration outcomes, smoke results, and operator/date without recording any
   credentials or personal data.

## Rollback and stop conditions

- If build, staging acceptance, or migration verification fails, stop before
  production activation and keep the prior production deployment unchanged.
- For a bad frontend release, the owner restores the last known-good Vercel
  deployment using the provider's deployment history, then verifies the
  read-only production smoke routes. Do not change domains or environment
  variables as an improvised rollback.
- Do not automatically drop tables, policies, or functions or delete rows to
  reverse a database migration. Preserve data and applied migration history;
  diagnose first, then use an owner-reviewed, forward-compatible corrective
  migration or a documented provider restore plan. Recheck app/database
  compatibility before any database restore.
- Keep the PR and Chapter 14 parent open while any required staging journey,
  owner setup, or production-review item remains blocked. Do not merge or
  activate production from this task.

## Redacted run record

| Date/time and timezone             | Exact reviewed app SHA                     | Environment label (no URL/project ref) | Result                                                                                                                                                                       | Remaining blocker                                      |
| ---------------------------------- | ------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-10-19 (timezone not recorded) | `00fcf280bd3be0d54ea3497679d23e80633207d4` | Staging Preview                        | #212 group-only → both selected groups, edit/delete, private-note privacy, and absence after refresh: PASS. Incognito `/dashboard` → app `/login`: PASS for this route only. | #155 journeys and broader #207/#212 matrix above       |
| 2026-10-19 (timezone not recorded) | `00fcf280bd3be0d54ea3497679d23e80633207d4` | Disposable local PostgreSQL            | 17 permission cases and 15 group-history projection cases: PASS. Local harness only; hosted migration state not verified.                                                    | Owner read-only hosted migration-ledger reconciliation |

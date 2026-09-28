# 14.7 — First connected app release checklist

This is a release gate and owner handoff, not approval to deploy or activate
production. No production settings, data, or deployment are changed by this
checklist. Do not treat local tests or mock responses as staging evidence.

## Current evidence and blockers

- Starting source: current `main` at `29082d3` on 2026-09-28, including the
  merged #154 and #194 implementation PRs.
- Local automated checks are recorded separately in the PR and refer to its
  exact tested head SHA.
- Live staging journeys: **NOT EXECUTED**. No approved preview URL or open
  staging browser tab was available to this task. The repository's prior live
  evidence records full application persistence as unverified.
- Staging migrations/configuration: **NOT INDEPENDENTLY VERIFIED**. Earlier
  setup and migration evidence is historical and does not establish current
  Preview-to-project targeting.
- Production activation, production migrations, and merge: **NOT PERFORMED**.

The release remains blocked until an owner supplies the exact approved
non-production preview URL and confirms that it targets a dedicated staging
Supabase project with disposable test identities and the current migration
set applied. The owner must enter any credentials directly in the existing
private browser/session; never send credentials, populated environment files,
or real personal data in chat or this repository.

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

| Journey                 | Required observation                                                                                                                                                                                                                                              | Result       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Solo registration       | A registers with the dedicated mailbox, confirms if required, signs in, and reaches the authenticated app. Verification returns safely to `/login`.                                                                                                               | NOT EXECUTED |
| Solo saved progress     | A creates a challenge, explicitly enrolls, saves a synthetic weigh-in, refreshes, and sees saved progress after a fresh sign-in. Correcting the same date leaves one record.                                                                                      | NOT EXECUTED |
| Recovery and errors     | Recovery confirmation does not reveal account existence; a valid dedicated recovery link resets the test password; expired/used links and simulated network failures show safe retry guidance.                                                                    | NOT EXECUTED |
| Group invitation        | A creates a group challenge and invite; B opens the invite, authenticates, accepts, and appears as an active member only after acceptance.                                                                                                                        | NOT EXECUTED |
| Group ranking and edits | A and B add synthetic Sunday records; the selected group's final Sunday ranking is correct. Late/corrected same-date records update the result after refresh, without duplicates.                                                                                 | NOT EXECUTED |
| Membership and privacy  | Active members can see only the allowed group aggregate/display names. Invited-before-acceptance, signed-out/anonymous, and unrelated identities cannot read protected group data. No other member's raw weight/history/note appears in UI or group RPC response. | NOT EXECUTED |
| Direct links and reload | Direct `/progress?challenge=<selected-id>`, `/group?challenge=<selected-id>`, and invite links load the exact selected challenge; refresh preserves valid route context and signed-out protected navigation returns through login safely.                         | NOT EXECUTED |
| Keyboard and mobile     | At a narrow mobile viewport, no clipped controls or horizontal page overflow; Tab order/focus is visible and primary links/forms/buttons work with Enter/Space. Repeat critical check on desktop.                                                                 | NOT EXECUTED |

Existing automated tests exercise mocked auth/repository boundaries and local
browser behavior, including protected direct routes, mobile shell/enrollment
layout, keyboard activation, form errors, password recovery states, group
summary privacy, and selected challenge behavior. They are not live staging
verification. The browser acceptance results above must be recorded
independently.

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

| Date/time and timezone | Exact reviewed app SHA | Environment label (no URL/project ref) | Staging result                                             | Owner / blocker    |
| ---------------------- | ---------------------- | -------------------------------------- | ---------------------------------------------------------- | ------------------ |
| NOT EXECUTED           | NOT RECORDED           | NOT PROVIDED                           | BLOCKED — preview URL and owner staging readiness required | Owner action above |

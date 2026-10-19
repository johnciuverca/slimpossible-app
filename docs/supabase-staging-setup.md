# Supabase staging setup handoff

This document is a preparation checklist for Issue #143 and the staging
candidate referenced below. It is not evidence that a live project has been
configured or migrated. No migration is run by CI or by the browser build.

## Owner confirmation required before any migration

The owner must confirm that the selected Supabase project is disposable,
non-production, and contains no personal production data. If that is not true,
the owner must select or create a dedicated non-production test project. Do not
apply these migrations to production.

The owner must also confirm the service is acceptable under their existing
account and plan. Codex will not create an account, upgrade a plan, or provision
a paid service.

## Project settings

In the owner-managed test project:

1. Enable the Email provider under Authentication → Providers.
2. Choose whether email confirmation is required for the test run. If it is
   enabled, use a dedicated test mailbox and complete verification there.
3. Add the local and preview redirect URLs under Authentication → URL
   Configuration. The local callback is the app origin (for example
   `http://localhost:5173`); the preview callback must be the exact owner
   preview URL. Do not guess a production URL.
4. For the release-gate snapshot, the exact staging candidate checked on
   2026-10-19 is `00fcf280bd3be0d54ea3497679d23e80633207d4`. Its 17
   timestamp-ordered migration files are:
   - `20260917000000_create_core_schema.sql`
   - `20260917000001_add_rls_policies.sql`
   - `20260922000000_harden_rls_authorization.sql`
   - `20260922000001_add_secure_challenge_invites.sql`
   - `20260924000000_add_privacy_safe_group_progress.sql`
   - `20260925000000_add_provisional_group_leader_summary.sql`
   - `20261005000000_add_personal_group_challenge_kinds.sql`
   - `20261005000001_converge_function_execute_grants.sql`
   - `20261006000000_add_opt_in_group_weigh_in_history.sql`
   - `20261007000000_personal_weigh_ins.sql`
   - `20261008000000_allow_draft_group_weigh_in_sharing.sql`
   - `20261009000000_add_group_chart_history.sql`
   - `20261012000000_add_group_target_change_milestones.sql`
   - `20261012100000_add_group_member_progress_projection.sql`
   - `20261013000000_correct_own_enrollment_starting_weight.sql`
   - `20261016000000_require_active_challenge_membership.sql`
   - `20261018000000_allow_group_owners_to_view_summaries.sql`

   Apply each migration once, in timestamp order, through the owner's approved
   non-production workflow. This candidate inventory is cross-checked against
   its source snapshot; it is not a claim that this main-based documentation
   branch contains all 17 SQL files or that the hosted staging migration
   ledger/schema has been reconciled.

   Checked-in rollback scripts cover only 8 of the candidate's 17 migrations:
   `20261005000000`, `20261005000001`, `20261006000000`, `20261007000000`
   (RPC compatibility restore), `20261009000000`, `20261012100000`,
   `20261013000000`, and `20261018000000`. There are no matching rollback
   files for `20261008000000`, `20261012000000`, `20261016000000`, or the
   initial core migrations. Do not infer the remote migration state from these
   checked-in files.

The owner should use the Supabase SQL Editor or an owner-approved migration
workflow and retain redacted execution evidence: project/environment name,
migration filenames, execution timestamp, and success/failure only. Never put
database passwords, service-role keys, access tokens, or populated environment
files in chat, source, logs, or issue comments.

## Browser and deployment configuration

For local or Vercel preview testing, the owner adds only these public browser
variables to the owner-managed environment:

```text
VITE_SUPABASE_URL=https://<test-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<test-project-anon-key>
```

The repository `.env.example` contains placeholders only. A service-role key,
database password, or project token must never be placed in a `VITE_` variable.
The owner separately decides whether the existing read-only activity workflow
should receive `SUPABASE_URL` and `SUPABASE_ANON_KEY` Actions secrets.

## Evidence still required

After owner setup, record separately whether each item is **verified live**,
**blocked**, or **not run**:

- the candidate's 17 timestamped migrations succeed on the fresh test database;
- tables, constraints, and RLS policies exist;
- local and preview builds point at the intended test project;
- sign-up, verification, sign-in, refresh, sign-out, profile initialization,
  challenge/participant/weigh-in persistence, and ownership denial pass;
- the read-only `/auth/v1/health` activity check succeeds, if configured.

The health request is only an activity signal; it does not prove that a free
plan will never pause. Do not mark any live item complete from mocked tests or
from a build without the owner-run evidence.

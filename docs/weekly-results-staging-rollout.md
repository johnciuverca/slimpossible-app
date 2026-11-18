# Weekly results Staging rollout

## Approved activation window

The approved first effective Sunday is **2026-11-22 at 20:00 Europe/Bucharest (18:00 UTC)**, only if the Staging verification gates below are complete before that instant. This is conditional approval for the date, not authorization to skip backup, review, or acceptance checks. If any gate is still open at the cutoff, do not initialize retroactively; choose a later future Sunday and repeat the preflight.

This document is a proposal for an operator with authorized Staging access. The feature branch, migration, function, or preview does not itself change a hosted database. Do not apply this sequence to Production/Live.

## Current state and proposed changes

Before this PR's migrations, weekly finalized results, immutable winner rows, and private candidate snapshots do not exist. Existing challenge owner/creator references are required, participant deletion is restricted, and there is no account-erasure function for removing avatar objects. The existing archived challenge deletion RPC only permits its owner.

The branch adds the finalization schema/RPC, makes weekly winner evidence anonymizable, scrubs relational account data from an Auth deletion trigger, and removes avatar objects through a caller-authenticated Edge Function. It marks account erasure with a service-role-only RPC before cleanup and blocks racing avatar uploads using a shared per-user advisory lock. Challenge deletion remains owner-only; if account erasure leaves an archived challenge ownerless, its future lifecycle needs an explicit product decision. The migration does not call the initializer. Local disposable-database tests prove the migration behavior; Staging must still verify hosted migration compatibility, function deployment/configuration, and an operator-controlled initializer.

## Staging backup gate

Before any hosted write, confirm the project ref and environment label identify **Staging**. Create a fresh recoverable backup and record its completion time, retention/expiry, storage location, and a successful restore or restore-rehearsal reference. The backup must cover:

- Auth users and profiles, including IDs and account metadata needed for restoration.
- Challenges, participants, invites, and ownership references.
- Legacy weigh-ins, target milestones, personal weigh-ins (including notes, dates and share flags), and personal weigh-in share mappings.
- All weekly result, winner, candidate, and candidate-week tables if already present.
- Applied migration history, relevant functions/triggers, RLS policies, grants, and table constraints.
- `profile-avatars` Storage object metadata and object bytes, with a tested restoration path.

Do not proceed if any required data class is missing, the backup is not recoverable, or the project/environment cannot be identified unambiguously.

## Read-only preflight

Run these checks using a read-only Staging connection. Capture the project ref, timestamp, query output, and operator in the release record. Do not run the initializer or a migration during preflight.

1. Confirm the expected migration inventory. Check `supabase_migrations.schema_migrations` for `20261113000000` and `20261116000000`. The expected state before this PR is that both are absent. If either is present, inspect its exact version and schema state and stop for a reviewed reconciliation; do not replay SQL manually.
2. Confirm `group_weekly_result_control` is absent before the first migration, or, if an earlier reviewed deployment has created it, inspect all rows and confirm no effective date is already active. Do not alter an existing control row as part of this preflight.
3. Record counts for profiles, challenges (by kind/status), participants (by status), legacy weigh-ins, personal weigh-ins and shares, invites, and avatar objects. Check for orphaned profile/member references and unexpected null challenge owners/creators. These counts provide the before-state for post-migration comparison; they do not authorize data cleanup.
4. Confirm the target branch SHA, migration files, Edge Function source, current Staging deployment SHA, and local verification evidence all match the reviewed PR revision. Confirm the function has `verify_jwt` enabled and the required `SUPABASE_URL`, anon key, and service-role secret are supplied by the platform environment, never committed to source.
5. Confirm the Staging backup gate above and the function's avatar removal path have been reviewed. The Edge Function must remove caller-owned avatar objects before invoking Auth deletion; its service-role credential remains server-side.

Any unexpected migration, active control row, orphan, owner-null group, row-count mismatch, missing backup, or function configuration mismatch is a stop condition requiring reconciliation before writes.

## Proposed write sequence (not executed)

After the owner confirms the backup and preflight record, and the PR SHA is the reviewed revision:

1. Apply the reviewed PR migrations to **Staging only**, in timestamp order: `20261113000000_add_finalized_group_weekly_results.sql`, then `20261116000000_anonymize_weekly_awards_on_account_deletion.sql`. Use the normal Supabase migration runner so migration history is recorded. Do not paste ad-hoc SQL into the dashboard.
2. Deploy `supabase/functions/delete-account` to Staging using the repository's explicit `supabase/config.toml` JWT-verification setting and secrets configured in the platform. Confirm the deployed function reports `verify_jwt = true`. Do not call it against real accounts during verification; validate its behavior only with a disposable Staging account and disposable avatar objects after explicit staging-test approval.
3. Compare the read-only before/after counts and constraints; inspect RLS/grants and the created triggers/functions. Run the disposable account-erasure scenario and the weekly-result scenarios against Staging only if separately approved. Confirm awards remain immutable, deleted-member rows have no account/member IDs, names, weights, or interpolation provenance, and archived challenge deletion removes all challenge-scoped evidence.
4. Only after the above verification, call `public.initialize_group_weekly_results` once with `p_effective_sunday = '2026-11-22'` under the authorized service-role context. This call creates the control record and seeds the finite Sunday horizon; it is the activation step. Record the returned result and verify the effective Sunday and seeded scopes with read-only queries.
5. If the activation cutoff has passed before all checks are complete, stop and repeat approval/preflight for a later future Sunday. Do not use the initializer with a past date.

No hosted migration, Edge Function deployment, initializer call, account deletion, challenge deletion, merge, or Production/Live release is performed by preparing this runbook. Production/Live requires its own backup, preflight, review, and explicit release authorization.

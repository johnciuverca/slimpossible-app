# Production backup and isolated restore rehearsal — #247

**Status: NOT EXECUTED. Owner-only procedure; not authorization to access or
copy production data, create a restore project, run SQL/migrations, change a
plan, or deploy.** A backup can contain real account data, private weigh-in
notes, and authentication records. Keep every artifact and detailed result in
owner-controlled private storage, never in this repository, GitHub, chat, CI,
or a shared/unreviewed drive.

## Owner-chosen freeze-before-backfill sequence

The owner chose this preparation path on 2026-10-21: schedule a short
weigh-in write freeze, block legacy writes before the one-time copy, deploy the
canonical app, verify canonical saves, then tell users to refresh and retry
any unconfirmed entry. This authorizes documentation and local tests only; it
does not authorize production access, SQL, migrations, settings changes, or
deployment.

The ordering matters. Migration `20261007000000_personal_weigh_ins.sql` copies
legacy `public.weigh_ins` into canonical `public.personal_weigh_ins` once. If
the fence waits until after app deployment, an old client can write to
`weigh_ins` after the copy; that row is not automatically copied to canonical
history. PR #305's former post-deploy-only timing did not close that window.

### Exact owner-run sequence

1. Complete the verified private backup and isolated restore/rehearsal gates
   below. Refresh the migration/catalog preflight and confirm the exact
   reviewed migration set. Confirm the Production project identity; stop on
   any ambiguity.
2. Schedule and announce the write-freeze window before changing the database.
   Tell users not to submit weigh-ins during the window; rejected old-client
   saves are not queued and will need to be entered again after the new app is
   verified. Keep the freeze notice active through step 7.
3. In the confirmed Production project, execute
   `supabase/manual-cutovers/freeze_legacy_weigh_in_writes.sql` in one
   transaction **before starting any file in the pending migration set**:

   ```sh
   psql "$PRODUCTION_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -f supabase/manual-cutovers/freeze_legacy_weigh_in_writes.sql
   ```

   The one-statement fence is outside `supabase/migrations`. It idempotently
   revokes only authenticated legacy INSERT/UPDATE and asserts those effective
   privileges are gone while legacy SELECT/DELETE remain. The script's
   assertions must succeed and the transaction must commit before any
   migration starts. If the command fails or its commit result is uncertain,
   use only a read-only ACL check to establish the state; stop until the
   fence is verified. Do not start migrations on an unverified fence.
4. Apply only the separately approved, reviewed migration set in its verified
   order. Do not repair or rewrite migration history as a shortcut. If any
   migration fails, keep the legacy fence and user notice in place; do not
   automatically re-grant writes or roll back.
5. Deploy the reviewed canonical app only after migration success. Keep the
   announced freeze in place while the owner runs the approved production
   smoke checks, including a canonical save and reload/visibility check with
   the approved test account and cleanup plan.
6. End the freeze notice only after canonical save and reload behavior is
   verified and production health checks pass. Tell users to refresh to load
   the canonical app and manually re-enter any value whose save was not
   confirmed. Do not imply failed entries were queued or automatically
   recovered. Keep the legacy INSERT/UPDATE fence permanently in place unless
   a separately reviewed recovery decision explicitly changes that policy.

The existing repository has no technical maintenance gate for canonical RPC
writes. The database fence blocks stale legacy-table writes, but the newly
deployed canonical app can accept canonical saves as soon as it is live. The
scheduled freeze therefore depends on the owner-notified window; do not claim
it is a technical block on all app writes. If a hard all-write lock through
smoke is required, stop and obtain separate approval for a reviewed app or
hosting gate before proceeding.

### Old-client experience and failure recovery

PR #305's refresh message is frontend code, not part of the SQL response
contract for every cached bundle. A client still running JavaScript from
before that change may show only a generic failure. No client-side retry or
queued save is established; rejected values must be re-entered after refresh
once canonical saves are verified. The freeze announcement must say so in
advance. Do not claim zero stale-client or data-loss risk.

The SQL fence is one atomic `DO` statement: if its revoke or any assertion
fails, that statement rolls back. It is idempotent, but run it with
`--single-transaction` as documented. If it fails before commit, do not
migrate; inspect the effective ACL read-only and request owner review. If a
migration, deploy, or smoke fails after the fence committed, leave the fence
in place, preserve the verified backup and evidence, and keep the freeze
notice active. The owner must choose an exact forward recovery or restore plan
after reconciling which migrations committed. Never automatically grant
legacy writes, restore a database, delete rows, or roll back migrations. Any
decision to resume legacy writes requires a separate owner approval and
verified restoration of the pre-freeze ACL only after confirming the
canonical copy/client cannot diverge.

## Current gate

Issue #247 reports that Production is on the Free plan without managed
database backups; a manual logical export is possible, but no production
backup or isolated restore has been verified. Reconfirm the plan and available
restore methods in the owner dashboard when the gate is scheduled. This guide
does not upgrade a plan or claim a backup exists.

The official [Supabase CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
exports roles, database schema, and data as separate files. The CLI excludes
Supabase-managed `auth` and `storage` schemas by default; customizations there
need separate treatment. A database export does not copy Storage object bytes.
The [backup documentation](https://supabase.com/docs/guides/platform/backups)
also states that database backups do not include Storage API objects. The
[Restore to a new project feature](https://supabase.com/docs/guides/platform/clone-project)
includes Auth user data, but requires a paid plan with physical backups and
does not copy Storage objects/settings or Auth settings/API keys. It also
copies database extensions that may immediately perform external operations.
Do not assume any one of these paths is a complete application recovery.

Before capture, the owner must select and record privately a supported method
that covers all required resources:

- database roles, schema, data, functions, triggers, RLS policies, grants,
  extensions, and the actual production baseline;
- Auth identities needed by `profiles` and other foreign keys, without
  exposing passwords, token material, or identity records in evidence;
- Storage bucket configuration and object bytes, if the production project
  contains or the application uses any; otherwise verify and record that none
  are required;
- separate project-level configuration needed for recovery, without copying
  production API keys, secrets, redirect settings, or production endpoints to
  the disposable target.

If the selected method cannot safely capture and restore a required resource,
stop. A `roles.sql`/`schema.sql`/`data.sql` set alone is not complete proof for
this app unless Auth references and any Storage dependencies are separately
covered. If the only viable method requires paid features or new services,
obtain the owner's explicit plan/cost approval before provisioning anything.

## Owner-run capture

1. Obtain explicit owner approval for the production snapshot and isolated
   rehearsal. Confirm the live app's configured Supabase project and the
   selected database project are the same intended Production project. Check
   both again immediately before capture; stop on any mismatch or ambiguity.
2. Confirm no migration, schema change, restore, or other maintenance is in
   progress. Record the UTC capture window and the method/tool versions in a
   private run record. Do not include URLs, project refs, credentials, account
   identifiers, or row values in Git or shared logs.
3. Select an owner-controlled, encrypted, access-restricted destination with
   sufficient space. It must not sync to a personal/shared cloud folder. Turn
   off shell tracing, use restrictive file permissions, and keep connection
   values in the owner's private local secret mechanism. Never paste them into
   a PR, chat, ticket, command transcript, or this document.
4. If the owner chooses the documented CLI logical export, first review the
   current Supabase guide and exclusions for this project. Its database files
   are separate exports, not a full Supabase project backup. A private local
   terminal command shape is:

   ```sh
   umask 077
   supabase db dump --db-url "$PRODUCTION_DB_URL" -f "$BACKUP_DIR/roles.sql" --role-only
   supabase db dump --db-url "$PRODUCTION_DB_URL" -f "$BACKUP_DIR/schema.sql"
   supabase db dump --db-url "$PRODUCTION_DB_URL" -f "$BACKUP_DIR/data.sql" --use-copy --data-only
   ```

   The owner supplies `PRODUCTION_DB_URL` and `BACKUP_DIR` privately in that
   terminal; neither value belongs in source control. Use only current,
   reviewed flags. Verify any excluded tables are genuinely outside the
   recovery scope, or stop and choose another approved method. Do not manually
   dump or restore managed Auth tables as an improvised workaround.

5. Inventory the required Auth, Storage, extension, and project-configuration
   components separately. For every component, record privately whether it is
   included, separately backed up by a supported process, verified absent, or
   still missing. A missing required component means the backup is incomplete.
6. Create a private manifest containing artifact names, byte sizes, SHA-256
   checksums, capture time, tool versions, coverage decisions, and the redacted
   environment label. Keep the manifest beside the encrypted artifacts.
   Check that every expected file exists, is non-empty where expected, and
   passes its checksum. Do not put dump excerpts, SQL output, UUIDs, emails,
   notes, or record-level data in the shared run record.

## Isolated restore and acceptance

1. Select a **new, disposable, separately identified** restore target. Confirm
   its project identity in the owner dashboard immediately before restore and
   after connecting. Never restore into Production or staging. Do not connect
   the production app, public domain, production Auth configuration, users, or
   API keys to it. Apply restrictive network/access controls and prevent
   outbound jobs, webhooks, cron tasks, or external extensions from contacting
   production or third parties. If that isolation cannot be guaranteed, stop.
2. Review the chosen restore method and its statements before execution. Use
   the vendor's current restore procedure with fail-fast and transactional
   behavior where supported. Do not bypass permission, ownership, trigger,
   extension, or constraint errors by editing a dump ad hoc. Stop, preserve
   private evidence, and obtain owner review of any discrepancy.
3. Verify the restored artifact checksums against the private manifest, then
   verify the target catalog and aggregate data manifest: expected schemas,
   tables, constraints, indexes, functions, triggers, RLS/policies, role
   grants, and row counts. Confirm Auth identities resolve every required
   profile foreign key. Confirm Storage metadata and object bytes match the
   declared coverage, or verify none are required. Check for orphaned
   references and constraint violations. Keep all comparisons aggregate or
   cryptographic; do not export row values into the run record.
4. Reconcile the restored production catalog to #247's recorded state: the
   five baseline migration effects are present and the twelve later
   migrations reported pending are not already applied. Those twelve files
   are the only intended schema delta for a separate rehearsal. Handle the
   production migration-ledger status as documented in
   [release-workflow.md](release-workflow.md). The recorded inventory of nine
   legacy weigh-ins and no duplicate `(user_id, recorded_date)` pairs is a
   comparison point, not a substitute for a fresh private source/restore
   comparison. Any changed count, duplicate, missing Auth reference,
   ACL/RLS/function mismatch, unexpected object, or unexplained migration
   state is a stop condition.
5. Mark restore acceptance only when every required resource is accounted for,
   the restore completed without unexplained errors, the private manifest
   matches, catalog/data checks pass, and an owner can repeat the recovery
   steps from the recorded procedure. Record only redacted environment labels,
   tested commit, UTC time, tool versions, aggregate pass/fail results, and
   operator. A local fixture, SQL-only test, successful dump, or checksum by
   itself is not restore proof.

## Separate migration rehearsal and #305 cutover order

Do not rehearse migrations on the only verified restore. Once that untouched
baseline restore passes, the owner may create another isolated disposable copy
for the approved rehearsal. First reconcile the catalog to the five baseline
migrations. The production ledger was reported absent; do not run
`supabase migration list`, `supabase db push`, migration repair, or direct
ledger edits until the supported history-reconciliation path and exact pending
file list have been reviewed and explicitly approved. Then rehearse only the
approved twelve-migration set from the current release candidate. Stop if the
dry-run differs, any migration errors, or privacy/ACL/data-preservation checks
fail. The rehearsal is not production approval.

The legacy write fence is **separate from** the twelve migrations and
`supabase db push`. In the isolated rehearsal, execute the manual fence
before the migration that copies rows. Verify the fence before proceeding,
that canonical RPC saves still work, and that rejected legacy INSERT/UPDATE
leave source rows unchanged. Test the actual older-client UX separately from
the updated PR #305 component; do not assume all cached bundles show the
refresh text. The SQL intentionally leaves legacy DELETE unchanged; that
remains a separate risk.

The owner-chosen sequence and failure recovery are recorded above. Before any
production execution, complete the isolated rehearsal and obtain the separate
owner approvals described there. If any migration,
fence, catch-up, deployment, or smoke step fails, stop, preserve the verified
backup and evidence, and wait for an owner-approved recovery decision. Never
automatically re-grant legacy writes, restore a database, delete data, or roll
back migrations.

## Cleanup and stop conditions

Keep the verified backup encrypted and private for the owner-approved
retention period; never delete it as part of rehearsal cleanup. After the
owner accepts the evidence and confirms the exact disposable target, the owner
may remove only that disposable restore and its temporary credentials. Verify
the target identity again before deletion. Securely remove temporary local
copies only under the approved retention policy. Record cleanup outcome
without recording secrets or user data.

Stop before any next action if project identity is uncertain; a required
resource is missing; target isolation or external-job suppression is
uncertain; checksums, restore, constraints, counts, catalog, migration
preflight, privacy, or ACL checks fail; a supposedly disposable target could
affect Production; or the selected method requires unapproved costs or
settings. Preserve the private backup and failed-run evidence for owner review.

**Current result: backup and restore rehearsal NOT EXECUTED.** The next action
is an owner decision, made privately, on a supported complete backup/restore
method for the current Production plan and the required Auth/Storage coverage.
No production data or backup has been accessed or changed by this PR.

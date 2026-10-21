# Production backup and isolated restore rehearsal — #247

**Status: NOT EXECUTED. Owner-only procedure; not authorization to access or
copy production data, create a restore project, run SQL/migrations, change a
plan, or deploy.** A backup can contain real account data, private weigh-in
notes, and authentication records. Keep every artifact and detailed result in
owner-controlled private storage, never in this repository, GitHub, chat, CI,
or a shared/unreviewed drive.

## Pilot backup waiver and remaining owner decisions

### Backup/restore waiver — limited pilot only

Owner direction relayed on 2026-10-21: the owner reports that all current live
and staging records are test data and chooses to proceed with the limited
family pilot without making a manual backup first. For this pilot only, the
owner waives the backup and isolated-restore rehearsal gate. This is a waiver,
not evidence: backup and restore remain **NOT EXECUTED**, and there is no
verified recovery point. A failed migration, mistaken write, or deployment
problem could leave records changed or unrecoverable. The waiver does not
authorize resetting or recreating a project, dropping/truncating tables,
deleting users or weigh-ins, copying staging data to live, or accepting data
loss. Preserve existing users and all nine reported legacy weigh-ins; keep
legacy entries private unless prior explicit sharing says otherwise.

This exception is limited to the named pilot. It does not establish a safe
backup/restore process, waive schema or migration-history reconciliation, or
authorize any hosted SQL, migration, settings change, or deployment. Revisit
backup/recovery before a broader release or any later operation outside this
pilot.

### Legacy-write cutover — owner decision still required

Migration `20261007000000_personal_weigh_ins.sql` copies legacy
`public.weigh_ins` into canonical `public.personal_weigh_ins` once. A legacy
client write after that copy will not automatically appear in canonical
history. PR #306 recorded a freeze-before-backfill plan, but the current owner
decision for this pilot is unresolved; do not treat that earlier plan as
selected or authorized.

The owner must choose one of these approaches before the fence, migration, or
deployment is scheduled:

1. **Short announced write pause:** ask users not to submit weigh-ins during
   the cutover window, then fence legacy writes before the one-time copy and
   keep the notice through canonical-save smoke checks. The existing SQL fence
   blocks stale legacy-table INSERT/UPDATE only; it does not technically block
   canonical RPC writes. Old clients may show a generic failure and do not
   queue or retry rejected entries.
2. **Catch-up without a pause:** first define and rehearse how writes arriving
   after the one-time copy are reconciled into canonical history without
   losing, duplicating, or changing existing rows or sharing. No such
   catch-up procedure is currently verified; do not assume rerunning the
   migration is safe.

The smallest remaining owner decision is: **may weigh-in submissions pause
for the cutover window, or must the release support a rehearsed catch-up path
without a pause?** Until the owner chooses, the cutover sequence is not
selected. The choice does not replace the separate migration-history and
schema preflight below.

### Freeze-option procedure — conditional, not selected

Use this sequence only if the owner chooses the short-pause option above and
separately approves the exact hosted operation. It is not the selected
cutover path today. Refresh the schema/migration-history preflight and confirm
the exact reviewed migration set before scheduling; confirm the Production
project identity and stop on ambiguity. Announce the pause and tell users not
to submit weigh-ins until the owner ends the notice. Rejected old-client saves
are not queued and may need to be re-entered after canonical behavior is
verified.

In the confirmed Production project, execute
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

After the fence is verified, apply only the separately approved migration set
in its verified order. Do not repair or rewrite migration history as a
shortcut. If any migration fails, keep the fence and user notice in place; do
not automatically re-grant writes or roll back. Deploy the reviewed canonical
app only after migration success. Keep the pause through owner-run smoke
checks, including canonical save/reload and visibility. End the notice only
after those checks and production health checks pass. Tell users to refresh
and manually re-enter any value whose save was not confirmed. Do not imply
failed entries were queued or automatically recovered. Keep the legacy
INSERT/UPDATE fence in place unless a separately reviewed owner decision
changes that policy.

The existing repository has no technical maintenance gate for canonical RPC
writes. The database fence blocks stale legacy-table writes, but the newly
deployed canonical app can accept canonical saves as soon as it is live. The
scheduled pause therefore depends on the owner-notified window; it is not a
technical block on all app writes. If a hard all-write lock through smoke is
required, stop and obtain separate approval for a reviewed app or hosting gate.

### Old-client experience and failure recovery (if the fence option is chosen)

PR #305's refresh message is frontend code, not part of the SQL response
contract for every cached bundle. A client still running JavaScript from
before that change may show only a generic failure. No client-side retry or
queued save is established; rejected values may need to be re-entered after
refresh once canonical saves are verified. The pause notice must say so in
advance. Do not claim zero stale-client or data-loss risk.

The SQL fence is one atomic `DO` statement: if its revoke or any assertion
fails, that statement rolls back. It is idempotent, but run it with
`--single-transaction` as documented. If it fails before commit, do not
migrate; inspect the effective ACL read-only and request owner review. If a
migration, deploy, or smoke fails after the fence committed, leave the fence
in place, preserve any private evidence or artifacts that exist, and keep the
user notice active. The owner must choose an exact forward recovery or restore
plan after reconciling which migrations committed. Never automatically grant
legacy writes, restore a database, delete rows, or roll back migrations. Any
decision to resume legacy writes requires a separate owner approval and
verified restoration of the pre-freeze ACL only after confirming the
canonical copy/client cannot diverge.

## Current gate

Issue #247 reports that Production is on the Free plan without managed
database backups. No manual backup or isolated restore has been verified. The
owner's waiver above applies only to the limited pilot; it does not change
this evidence status or imply that a backup exists.

The standard [Supabase CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
exports roles, schema, and data separately and excludes platform-managed
`auth`/`storage` tables from its normal dump. Supabase separately documents a
direct [`pg_dump` path that can include `auth` and `storage`](https://supabase.com/docs/guides/troubleshooting/pg_dump-fails-with-query-would-be-affected-by-row-level-security-policy-1d5783);
that path has not been rehearsed for this project and is not part of the pilot
waiver. Its example backup role requires explicit role/grant setup and is not
strictly read-only. Neither database dump includes Storage object bytes; see
the [Storage migration guidance](https://supabase.com/docs/guides/storage/management/download-objects).
Do not treat documentation of an export method as proof of a successful
restore or complete application recovery.

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

For any future backup/recovery rehearsal, if the selected method cannot safely
capture and restore a required resource, stop. A
`roles.sql`/`schema.sql`/`data.sql` set alone is not complete proof for this
app unless Auth references and any Storage dependencies are separately
covered. A pilot waiver does not make an incomplete export complete.

## Future owner-run capture (not part of the waived pilot)

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

## Future isolated restore and acceptance (not part of the waived pilot)

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

The pilot waiver covers only the backup and restore rehearsal. It does not
waive fresh schema/migration-history reconciliation or the separate review of
the exact migration set. No verified production-baseline restore exists, so
do not claim the production migration rehearsal has been completed or apply
migrations based only on the historical five-effect/twelve-pending inventory.
Reconcile the source state and rehearse the reviewed set in an owner-approved
isolated environment before any production migration.

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
`supabase db push`. In an isolated rehearsal, test only the cutover path the
owner selected: the fence-before-copy sequence for a pause, or the approved
catch-up behavior for a no-pause cutover. Verify that canonical RPC saves
still work and that rejected legacy INSERT/UPDATE leave source rows unchanged
when the fence path is selected. Test older-client UX separately from the
updated PR #305 component; do not assume all cached bundles show refresh text.
The SQL intentionally leaves legacy DELETE unchanged; that remains a separate
risk.

The cutover choice remains open as recorded above. Before any production
execution, reconcile the schema/migration history, settle the cutover choice,
and obtain separate owner approval for the exact operations. The pilot backup
waiver does not alter these gates. If any migration, fence, catch-up,
deployment, or smoke step fails, stop, preserve any private evidence or
artifacts that exist, and wait for an owner-approved recovery decision. Never
automatically re-grant legacy writes, restore a database, delete data, or roll
back migrations.

## Cleanup and stop conditions

If a backup is later created, keep it encrypted and private for the
owner-approved retention period; never delete it as part of rehearsal cleanup.
After the
owner accepts the evidence and confirms the exact disposable target, the owner
may remove only that disposable restore and its temporary credentials. Verify
the target identity again before deletion. Securely remove temporary local
copies only under the approved retention policy. Record cleanup outcome
without recording secrets or user data.

Stop before any next action if project identity is uncertain; a required
resource is missing; target isolation or external-job suppression is
uncertain; checksums, restore, constraints, counts, catalog, migration
preflight, privacy, or ACL checks fail; or a supposedly disposable target
could affect Production. Preserve any private backup and failed-run evidence
for owner review.

**Current result:** backup and restore rehearsal **NOT EXECUTED** and waived
only for the limited pilot by owner direction. The current gates remain the
owner's freeze-versus-catch-up choice and a fresh schema/migration-history
preflight. No production data or backup has been accessed or changed by this
PR.

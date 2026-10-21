# #247 — Conservative pilot pause and forward-recovery proposal

**Status: owner review required; proposal only.** This document records a
human-requested pause and data-preserving investigation path for the limited
pilot. It is not an implemented kill switch, technical write lock, automated
alert, database rollback, or authorization to change hosting/database state.
Backup and isolated-restore rehearsal remain **NOT EXECUTED** and are waived
only for this limited family pilot, as recorded in the
[`#247 runbook`](production-backup-restore-rehearsal.md). The waiver is not
recovery evidence, does not authorize hosted SQL, migrations, settings changes,
or deployment, and does not extend to broader release or later operations.
Fresh schema/migration-history preflight, applicable isolated migration
rehearsal, cutover steps, and separate exact-operation approvals remain
distinct gates. A broader production release or later operation remains
subject to the runbook's backup/restore requirements.

## Trigger and immediate human response

For the limited pilot, any reported or suspected privacy exposure, data
correctness/integrity concern, or weigh-in save failure is a stop signal. Do
not wait for a numeric error-rate threshold: no application telemetry or
automatic alerting is configured in this repository.

The owner/PM requests that pilot users pause weigh-in submissions and sharing
changes while the issue is assessed. Do not ask users to add, edit, delete,
share, or unshare weigh-ins during the pause. Preserve existing records and
leave the application, database, grants, migration history, and settings
unchanged while evidence is collected.

Suggested human notice, sent through the owner-approved private pilot
communication channel:

> We are temporarily pausing weigh-in entries and sharing changes while we
> investigate. Please do not add, edit, delete, share, or unshare weigh-ins.
> Previously saved records are being preserved. We will tell you when it is
> safe to resume.

The current application has no in-app maintenance banner or operator-controlled
feature switch. This notice is out of band and human-requested. It asks users to
stop; it does **not** prevent writes. Stale clients and direct calls to the
canonical RPCs may continue to work if the database still permits them. The
manual legacy fence described in the release runbook only revokes legacy-table
`INSERT`/`UPDATE`; it does not block canonical RPC saves/deletes and is not a
general pilot pause control. Do not apply or repurpose that SQL as part of this
proposal.

If an enforceable pause or in-app maintenance state is required, stop and open
a separate code/release gate for an app-level notice plus a reviewed
server-side control covering the selected write paths, including stale legacy
clients. Verify that control against direct RPC calls and cached clients before
relying on it. No such control is implemented here.

## Evidence collection and escalation

The owner or PM may manually inspect available evidence in owner-controlled
systems, if access and retention permit:

- Record the reported time and timezone, affected route/action, visible result
  or error text, and the deployed commit/environment label. Do not record a
  user's identity in this shared document.
- Preserve a redacted screenshot or browser console/network observation when
  useful. Remove cookies, authorization headers, access/refresh tokens, private
  notes, request bodies, and personal record values before sharing anything.
- Check the Vercel deployment/build details for the exact deployed frontend.
  A successful deployment is not proof of database health or data correctness.
- If retained and available, inspect Supabase API/Postgres logs around the
  reported time for relevant RPC/permission errors. Review them privately and
  redact identifiers and row contents. The app does not forward browser errors
  to Vercel, and the repository does not configure automatic client-error
  collection; absence of a log entry is not evidence that no failure occurred.
- Compare affected records only through an owner-authorized, privacy-preserving
  procedure. Do not edit records, retry writes, replay requests, or infer a
  missing save from UI text alone during triage.

For any suspected cross-user disclosure, unexplained row change/loss, duplicate,
or inability to establish whether a save committed, keep the pause in place and
notify the owner and PM promptly through the project's approved private
escalation channel. Do not publish private evidence in this repository, a PR,
or a general chat. If the channel has not been designated, the owner must name
it before the pilot; this proposal does not invent an incident channel or
retention period.

## Recovery posture: fix forward, do not roll back the database

Treat a frontend deployment rollback and a database rollback as different
operations:

- A Vercel rollback changes the served frontend only. It does not reverse
  schema changes or restore records. After canonical writes begin, an older
  client can omit canonical-only entries and show stale legacy data; it is not
  a safe default response to a weigh-in failure.
- Migration `20261007000000_personal_weigh_ins.sql` copies legacy rows into
  canonical tables while retaining the legacy source and provenance. Its
  companion rollback restores older RPC bodies but deliberately keeps
  canonical rows, shares, and provenance. Its comments warn that old clients
  will not display canonical-only entries and that legacy reads may be stale.
  Do not flatten private or multi-group canonical entries into the legacy
  challenge-specific table.
- The repository has no automatic down migration for
  `20261008000000_allow_draft_group_weigh_in_sharing.sql` or
  `20261012000000_add_group_target_change_milestones.sql`; the original core
  migrations also lack automatic down scripts. The `20261006000000` rollback
  drops per-entry sharing choices. Other guarded rollback scripts have
  migration-specific preconditions and data effects; their presence is not
  approval to run them.

During triage, do not reset, truncate, delete, restore, repair migration
history, re-grant legacy writes, or run an inverse migration. Preserve the
current state and evidence. If code is defective, prepare a reviewed,
backward-compatible forward correction that preserves canonical and legacy
data; use the approved staging review/test process before asking the owner
whether to resume. If data integrity is uncertain, do not resume on the basis
of a frontend patch alone. Do not assume a backup or verified restore exists:
both remain **NOT EXECUTED** and waived only for this limited pilot. Before any
broader production release or later operation outside the waiver, complete the
runbook's verified backup/restore gate. The waiver does not remove the fresh
schema/migration-history preflight, applicable migration rehearsal, cutover, or
separate exact-operation approval requirements.

## Resume criteria

Keep the human-requested pause active until all applicable criteria are met:

1. The owner/PM has recorded the affected commit, environment, failure mode,
   redacted observations, and whether any save outcome or privacy exposure is
   still uncertain.
2. A focused fix has been reviewed and its relevant local/CI tests pass. If
   database behavior is implicated, use only the separately authorized,
   isolated rehearsal path; this proposal does not authorize hosted SQL.
3. The owner has verified the corrected behavior on the exact candidate and
   confirmed the relevant existing records/privacy behavior remain intact,
   without repeating unrelated completed journeys.
4. No unresolved privacy or data-correctness concern remains, and the owner
   explicitly tells pilot users that the pause is over.

If a technical lock is required to satisfy any of these conditions, the pilot
does not have that safeguard today. Keep the pause human-requested and
non-enforcing until a separate, tested server-side gate is implemented and
approved. Never describe manual log inspection as monitoring or an alert, and
never infer that a notice blocks stale clients or RPC writes.

## Owner review items

- Confirm this trigger and response applies to the limited family pilot.
- Designate the private pilot notice/escalation channel before the pilot.
- Decide separately whether a future enforceable server-side/app maintenance
  gate is required before any broader release; this proposal does not implement
  one.

No database, backup, migration, hosting setting, or deployment action was
performed to prepare this proposal.

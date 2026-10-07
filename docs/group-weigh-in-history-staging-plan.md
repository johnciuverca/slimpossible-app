# Issue #209 staging and recovery plan

This is a preflight plan, not approval to apply SQL or merge PR #230. No
connected SQL, migration, backup, or restore was run for this change.

## Destination and current read-only observations

- Supabase project: `slimpossible-staging`, project ref
  `erylzsdmsohvssgqwfor`. The Supabase dashboard's `main Production` database
  branch label is not the application's live/Production Supabase project.
- Expected stable Vercel staging branch URL in the release runbook:
  `https://slimpossible-app-git-staging-cvc10.vercel.app`. Before testing,
  the owner must verify the exact Preview deployment is for the reviewed PR
  head SHA and its branch-scoped public variables point to the project above.
- PM's read-only staging inspection on 2026-10-06 found
  `supabase_migrations.schema_migrations` absent, `challenge_kind` present,
  `share_with_group` absent, and
  `get_group_weigh_in_history(uuid)` absent. PM also confirmed the #208 ACL
  correction is already applied: anon cannot execute the membership helper or
  trigger-only guards, authenticated can execute the membership helper but not
  the trigger-only guards, and both anon/authenticated can execute invite
  preview. No #209 SQL was applied.
- PM observed that this Free Plan does not include scheduled hosted backups.
  A manual logical dump remains possible, but no backup or restore rehearsal
  has been produced or verified for this change.

## Required read-only preflight

Before any owner-authorized migration:

1. Reconfirm in the owner dashboard and SQL editor that the selected target is
   `slimpossible-staging` / `erylzsdmsohvssgqwfor`, not the live/main project.
2. Run `supabase/tests/staging_catalog_audit.sql` as one read-only transaction
   and retain a private, redacted export. Compare columns, constraints,
   indexes, policies, triggers, extension, and all relevant function bodies,
   owners, search paths, security-definer flags, and direct ACLs with the
   reviewed migrations. Confirm the new share column and history RPC are
   absent before the migration. Export effective/direct ACLs and function
   defaults; unexpected drift is a stop condition.
3. Confirm the post-#208 ACL correction remains intact, including the
   membership helper and invite-preview grants above. Do not rerun
   `20261005000001_converge_function_execute_grants.sql`.
4. Review the exact proposed delta: one `boolean NOT NULL DEFAULT false`
   column, one narrow authenticated-only RPC, no historical backfill, no RLS
   policy change, and no note exposure. Confirm the entire forward migration
   is listed as the sole expected pending file by the supported migration
   workflow after migration history is reconciled.

## Migration-history prerequisite from #208

The staging schema was manually prepared and inspected, but PM observed that
the `supabase_migrations.schema_migrations` ledger table is absent. The six
core migrations, `20261005000000_add_personal_group_challenge_kinds.sql`, and
`20261005000001_converge_function_execute_grants.sql` therefore must not be
replayed to staging. First compare the complete live catalog/ACL state against
all eight already-applied migration results. Only after that equivalence is
reviewed may the owner use Supabase's supported migration-history workflow to
reconcile those eight versions. This reconciliation remains OUTSTANDING. Do
not create/repair ledger rows manually, use `db reset`, or hide unexplained
drift. The ledger must be reconciled before using CLI `supabase migration list`
and `supabase db push --dry-run`; after that, the only expected pending file is
`20261006000000_add_opt_in_group_weigh_in_history.sql`. An alternate SQL-editor
route would be a separate owner/PM-approved operation applying only that exact
file once; it must never replay the eight earlier migrations. Neither route is
authorized by this plan. No connection string is requested or recorded here.

## Backup, forward, and recovery gates

The forward migration and inverse are each transaction-wrapped so an SQL
editor error cannot commit only the column or only the RPC. Local recovery
verification must show forward => column/RPC present, inverse => both absent,
and re-forward => both restored, while pre-existing weigh-in rows remain.
PM ran the isolated local runner successfully: 17/17 new history assertions
passed before and after inverse/re-forward; the existing local history suite
passed 11/11; the #208 ACL suite passed 11/11 across phases; and sentinel
preservation plus placeholder/malformed/duplicate/missing-ID guards passed.
The local cluster was stopped. This does not prove connected staging behavior
or that a remote backup works.

Before applying on staging, the owner must create and rehearse a manual
logical backup. Supabase documents a `supabase db dump` route producing
separate roles, schema, and data exports; the owner should use its current
documented flags, enter the staging connection privately in a trusted local
terminal, and keep the files encrypted/private and outside this repository.
Restore them into an isolated disposable Supabase project and verify the
restore, then rehearse the exact forward migration and inverse there. See
[Supabase's backup/restore CLI guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
Do not paste the connection string or export contents into chat, PRs, shell
logs, or this repository. If any explicit share choices have been collected,
the inverse drops them with the column: preserve and validate those values
through the owner-approved recovery process before considering rollback.
Revert the app to a version that does not call the RPC before applying the
inverse. Never drop the column as an automatic response to a frontend failure.

## Connected rollback-only authorization harness

After the approved migration is applied and verified, run the whole
`supabase/tests/group_weigh_in_history_staging_authorization.sql` in one
staging SQL-editor batch as `postgres`. The owner must replace all three
placeholders with explicitly approved, existing disposable owner/member/
outsider Auth UUIDs. The script rejects unfilled/malformed IDs, duplicate IDs,
and IDs absent from `auth.users` before fixture DML; it never selects users by
creation order and never creates an account. It uses `ON CONFLICT DO NOTHING`
for profiles so existing names are preserved. Temporary challenge,
participant, and weigh-in fixtures are all removed by the final `ROLLBACK`.

Expected checks cover unauthenticated and anon denial, active member and owner
visibility limited to explicitly shared date/weight fields, default-private
historical rows, no notes or raw identity columns, outsider denial, a withdrawn
member denial, and immediate removal from both member and owner views after a
row is unshared. All 17 results must pass. The three previously owner-approved
disposable identities may be reused; at execution, verify privately that they
still exist, hold the intended roles, and belong to the correct staging target.
Do not create users or disclose their IDs. On any SQL error, issue `ROLLBACK`
before another query and verify no fixture remains. Record only environment,
reviewed SHA, date, and pass/fail counts; do not publish UUIDs, names, weights,
notes, invite tokens, or database exports.

## Current outcome

Pre-migration catalog and ACL observations: PM-reported, read-only, 2026-10-06.
Connected #209 authorization harness: NOT EXECUTED. Backup/restore rehearsal:
NOT EXECUTED; there is no backup evidence yet. Smallest owner action: privately
create a manual logical backup and complete the isolated restore rehearsal;
verify the exact Preview deployment and the approved disposable role identities
in owner-controlled interfaces. No credentials or populated environment files
are needed in chat.

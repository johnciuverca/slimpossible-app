# Issue #208 staging and recovery plan

## Scope and destinations

PR #226 targets `staging`. It integrates staging `160762c` and main's reviewed
navigation fix `cd11978`; newer dashboard, chart and fixture coverage are retained.
No dual-save or shared raw history work is included. No merge is authorized here.

On 2026-10-05 the staging SQL editor was explicitly confirmed as project
`erylzsdmsohvssgqwfor` (`slimpossible-staging`). Live/main uses
`xtpbjhdzerdgaaxnsbtu`; older evidence describing that project as staging is
historical and must not be used to choose today's migration destination.
The dashboard's `main Production` badge denotes the default database branch of
the staging project, not the application's live Supabase project.

## Executed read-only catalog comparison (2026-10-05)

Ran `supabase/tests/staging_catalog_audit.sql` in the staging SQL editor. It uses
a read-only transaction and returns definitions, not user records. Compared the
final state of these seven timestamp-ordered migrations:

| Version          | Final-state comparison                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260917000000` | Core columns/types/defaults, PK/FK/check/unique constraints and indexes agree.                                                                                                         |
| `20260917000001` | Four core tables have RLS; own-profile, owner-management and private-weigh-in policy predicates agree. Challenge SELECT is correctly superseded by later migrations.                   |
| `20260922000000` | Membership helper and participant trigger exist; their bodies are correctly superseded by subsequent migrations.                                                                       |
| `20260922000001` | Invite table/index/constraints, five invite RPC bodies, immutable ownership and unconditional participant-identity guard agree. Invite table has no anon/authenticated grants.         |
| `20260924000000` | Group progress body, signature, security-definer/search-path settings and authenticated-only client EXECUTE agree.                                                                     |
| `20260925000000` | Provisional leader body, signature, security-definer/search-path settings and authenticated-only client EXECUTE agree.                                                                 |
| `20261005000000` | Nullable/no-default kind column, validated personal/group/NULL constraint, SELECT privacy guard and three restrictive participant policies agree. Both kind/invite guards are enabled. |

Audit totals: 41 columns, 31 validated constraints, 14 indexes, 18 policies,
four enabled non-internal triggers and 13 relevant functions across five tables.
All 13 final function bodies matched the last repository definition after
removing comments and collapsing whitespace; signatures, search paths and
security-definer flags were also inspected. `pgcrypto` is in `extensions`,
compatible with the qualified invite digest/random-byte calls.

**Discrepancies, not schema failure:**

- `supabase_migrations` has no tables: applied-version lineage is unrecorded.
- Explicit `anon` EXECUTE remains on accept/create/list/revoke invites,
  `get_challenge_progress_summary`, `is_challenge_member`, ownership/participant
  guards and both new guard functions. The repo revokes PUBLIC but does not
  explicitly remove Supabase's direct/default role grants. Both new trigger
  functions also retain authenticated EXECUTE, although the migration grants
  none. Public RPC bodies have authorization checks; this audit is not proof
  of an exploit or of connected acceptance. This grant drift requires review,
  not blindly marking the project equivalent. Preview-invite anon EXECUTE is
  intentional; group and provisional RPCs already explicitly revoke anon.
- Platform service-role grants and core table grants are separate Supabase
  defaults, not evidence of missing RLS. Service-role access bypasses RLS and
  must never be used for client acceptance.

## Convergence and application sequence (not executed)

1. Owner exports schema/role grants and backs up data securely, records the
   recoverable snapshot/time and rehearses restoration in an isolated target.
   A free-tier project or a dashboard badge is not proof of a usable backup.
2. PM reviews grant drift. Prepare a narrow reviewed delta to explicitly revoke
   anon EXECUTE from the ten non-public functions above; revoke authenticated
   EXECUTE from the two new trigger-only functions. Preserve authenticated RPC
   grants, intentional anon preview access and platform service-role grants.
   Capture before/after ACLs and an exact inverse delta for recovery. No such
   change has been applied by this PR's audit.
3. Re-run the catalog export and scoped acceptance. Review any remaining drift
   before recording lineage. Only after definition equivalence is approved may
   an owner reconcile the seven manually applied version records using the
   supported migration bookkeeping workflow. Do not use ledger repair to hide
   unexplained drift. Keep SQL checksums, dated export and review together.
4. Do not replay any of the seven migrations on staging: their objects already
   exist. Do not reset the database or backfill NULL kinds. Future migrations
   require a reconciled ledger and reviewed dry run against the exact project.
5. Production is a separate gate: fresh read-only comparison, approved backup
   and restoration plan, exact reviewed delta/migration order, explicit owner
   database authorization and a separately reviewed staging-to-main release.

## Connected acceptance (not executed)

The updated `supabase/tests/personal_group_challenges_authorization.sql` requires
three **explicitly owner-approved, existing disposable** UUIDs (owner/member/
outsider). Unfilled/invalid/missing/duplicate IDs fail before fixture DML. It
does not select earliest users or require that the entire project have only
three accounts. Run the complete file in one SQL-editor batch on staging;
random challenge IDs and `[16.1 disposable]` labels isolate test records.
The final `ROLLBACK` removes fixtures and any new profiles. Existing profile
names, challenges and weigh-ins are neither updated nor deleted. If execution
errors, issue `ROLLBACK` before any subsequent query; never commit that batch.
The previous local 11/11 result used the older harness and a minimal native
PostgreSQL Auth shim, not this revised harness or connected Supabase identities.

Next owner step: privately identify the three disposable staging Auth UUIDs
and designate their roles; do not send passwords or service-role keys. No
accounts will be created. Sign into the feature Preview with the disposable
owner when browser acceptance is scheduled. Confirm the Preview's actual
network destination is staging before test actions. Browser acceptance must
cover coexistence, explicit enrollment, refresh/account switch, selected
navigation and weigh-in destinations; SQL RLS checks do not replace it.

## Recovery gates

Revert the application before considering schema rollback. The checked-in
guarded rollback aborts if any personal challenges exist: dropping the kind
would erase their privacy classification. Do not delete or reclassify existing
personal rows to bypass that guard. Preserve them via reviewed restoration or
forward repair, with the owner choosing the recovery route. A backup/restore
rehearsal, actual connected acceptance and production authorization remain
pending; code/CI success alone is not release approval.

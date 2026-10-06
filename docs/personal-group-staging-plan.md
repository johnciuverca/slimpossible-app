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
2. PM reviews grant drift. The checked-in `20261005000001` candidate explicitly revokes
   anon EXECUTE from the ten non-public functions above; revoke authenticated
   EXECUTE from the two new trigger-only functions. Preserve authenticated RPC
   grants, intentional anon preview access and platform service-role grants.
   `supabase/tests/function_execute_acl_audit.sql` exports before/after ACLs,
   effective privileges and defaults. The matching `supabase/rollback` file
   is the exact inverse of the inspected snapshot. Both files abort on ACL
   drift or a non-postgres execution role; neither overwrites unknown grants.
   This eighth migration is **NOT APPLIED remotely**. Its recovery restores
   the earlier exposure, so recovery also needs explicit approval.
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

## Connected acceptance (partial, PM-reported)

The updated `supabase/tests/personal_group_challenges_authorization.sql` requires
three **explicitly owner-approved, existing disposable** UUIDs (owner/member/
outsider). Unfilled/invalid/missing/duplicate IDs fail before fixture DML. It
does not select earliest users or require that the entire project have only
three accounts. Run the complete file in one SQL-editor batch on staging;
random challenge IDs and `[16.1 disposable]` labels isolate test records.
The final `ROLLBACK` removes fixtures and any new profiles. Existing profile
names, challenges and weigh-ins are neither updated nor deleted. If execution
errors, issue `ROLLBACK` before any subsequent query; never commit that batch.
The revised harness was verified locally on 2026-10-05: **11/11 checks passed
before correction, after correction and after inverse recovery** in native
PostgreSQL 16.12 with a minimal Auth compatibility shim, explicit local UUIDs
and Supabase-style direct/default grants. Four local Auth rows existed (an
unselected account was created earliest), so this also exercises selection
without relying on creation order or an exactly-three-user project.

Reproduce only in an isolated local database with
`bash supabase/tests/run_local_personal_group_acl.sh`. The runner creates its
own temporary cluster with no TCP listener and stops it on exit. It retains
before/after/recovery ACL exports and local evidence under its printed temp
path; these are disposable local records, not staging users or credentials.
Its LOCAL ONLY shim/fixtures/assertion SQL must never run on a remote project.

Additional local assertions passed: 13 effective function ACLs in each phase;
exact recovery of grantors/grant options; anonymous membership-helper denial;
authenticated membership/RLS and invite issuance still usable; anonymous
invalid-token invite preview still callable; unchanged intentional preview,
aggregate and service-role grants; sentinel profiles/challenge/participant/
weigh-in preserved exactly, with no leftover fixtures or inserted profile.
Unfilled, duplicate and nonexistent UUIDs were rejected before DML. Both grant
forward/recovery scripts rejected injected PUBLIC EXECUTE drift before partial
changes. CREATE OR REPLACE preserved the corrected helper ACL. New functions
still inherit the unchanged platform defaults: every future migration must
explicitly review client grants. None of this replaces connected acceptance.

On 2026-10-06 PM reported observing actual feature Preview requests to
`erylzsdmsohvssgqwfor.supabase.co` for Auth token, profiles, challenges,
participants, weigh-ins and group RPCs. This is PM-observed network evidence,
not an inference from the Remote authentication label; no credentials are
recorded here. This agent's earlier invalid-token lookup alone did not establish
the host. Owner/member/outsider SQL acceptance remains unexecuted remotely.

PM also reported that the owner created a private personal test context without
overwriting the existing group, explicitly enrolled with a 100-to-85 kg goal,
saved remotely and saw an active participant. The success panel incorrectly
offered Invite participants for the personal context. The follow-up fix omits
that action for personal kind and preserves it for explicit/legacy groups;
focused tests cover newly saved and existing membership. The corrected UI
still needs a connected recheck on its new Preview deployment. These partial
owner observations do not establish complete multi-account/privacy acceptance.

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

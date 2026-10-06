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

**Discrepancies, not schema failure (before the separately reviewed permission
correction recorded below):**

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

1. Match recovery to the proposed delta. For the permission-only
   `20261005000001` correction, retain a fresh private direct/effective ACL export,
   including owners, grantors, grant options and function defaults; compare it
   with the guarded forward/inverse files and retain the local recovery rehearsal.
   Re-export immediately before application and abort on drift. The exact inverse
   restores the inspected grants without touching data or schema, but requires
   explicit approval because it restores earlier exposure. A full data restore
   rehearsal is a separate gate for schema/data changes and production release,
   not a prerequisite for this permission-only delta. A dashboard badge alone is
   never evidence of a usable data backup.
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
the host. Connected owner/member/outsider SQL checks were subsequently executed
as described below; they do not establish complete browser acceptance.

### Executed rollback-only staging SQL checks (2026-10-06)

The owner approved three specific existing disposable identities and the exact
staging project above. A private, exact-email Auth lookup resolved each role to
one existing user and confirmed distinct UUIDs; no accounts were created and no
identity mapping is published here. The fresh read-only ACL export matched the
candidate correction's expected owners, direct grants, grantors and options. The
ten non-public functions then retained the previously identified anon grants;
the two new trigger-only functions also retained authenticated EXECUTE.
Intentional preview access, group/provisional grants and function defaults were
unchanged at preflight.

The complete checked-in authorization harness ran in one BEGIN/ROLLBACK batch:
**11/11 connected checks passed**. Assertions used authenticated role and JWT
subjects for owner/member/outsider; postgres only prepared isolated fixtures.
Checks covered owner visibility and explicit enrollment, no implicit enrollment,
denial of adding another person to personal challenges, denial of personal
invites and kind changes, preserved group invite/member access, member personal
challenge/participant non-disclosure and outsider non-disclosure.

Before/after private row-count and content-digest fingerprints matched for
profiles, challenges, participants, weigh-ins and challenge invites. No labelled
fixtures or temporary results table remained; postgres role was restored and
the JWT subject was clear. All 13 audited function ACLs and function defaults
matched the pre-run snapshot. No permanent ACL/schema changes or ledger repair
were performed, and production was untouched.

An initial editor submission was rejected at SQL parsing because the editor
inserted the harness into the preceding query. An explicit ROLLBACK and
read-only audit confirmed no changes. Clipboard replacement then verified an
exact match to the harness before the successful execution above. Fingerprints,
account identifiers and personal values are retained privately, not published.

### Applied staging permission correction and post-change checks (2026-10-06)

After PM review and owner authorization, a fresh private ACL export matched the
guarded migration preflight, the previous owners/grantors/grant options and
default ACL snapshot; the inverse matched the exact inspected prior state. The
checked-in `20261005000001_converge_function_execute_grants.sql` ran as one
transaction on staging project `erylzsdmsohvssgqwfor` under postgres. The
transaction completed successfully.

An immediate export verified only the intended delta: anon EXECUTE removed from
the ten listed functions; authenticated EXECUTE removed only from the two
trigger-only guards. Authenticated membership execution, anon invite-preview
execution, other intended grants, function owners/grantors/options and public /
storage default ACLs were preserved. No schema, migration ledger or table data
was changed.

The rollback-only authorization harness then passed **11/11** again under the
corrected ACLs. A final read-only export confirmed all five app-table
fingerprints unchanged across the run, exact post-correction function ACLs and
defaults still present, and no leftover fixtures or temporary table. The
postgres role and clear JWT state were confirmed. The inverse was retained as
recovery evidence and was not executed. Account identifiers and fingerprints
remain private.

### Redacted PM-observed browser UI checks (2026-10-06)

These are PM-reported visible UI observations, not this agent's SQL or server
payload verification. No fixture identifiers, account addresses, measurements,
goal values or computed health metrics are included. PM independently inspected
visible DOM account identity for each role's observation.

- Owner checked personal/group coexistence, explicit self-enrollment, saved
  entry display and distinct selected-context Progress displays. Switching back
  retained the personal context's displayed entry. This is an observed switching
  check, not a complete refresh/account-switch/navigation matrix.
- Member checked the group-only Overview listing and a direct link to the
  owner's personal Progress. The direct link showed the unavailable state and
  did not display weight, goal or history fields.
- Outsider separately checked the direct personal Progress link after visible
  identity inspection. It showed the same unavailable state and no weight,
  goal or history fields. UI non-disclosure does not prove server payload privacy.
- Owner enrollment's success panel originally offered Invite participants for
  personal kind. The fix at `299e8e5` omits that action for personal kind and
  preserves it for explicit/legacy groups. PM's October 6 connected owner
  recheck confirmed the personal existing-enrollment panel shows already
  participating, omits Invite participants, and keeps personal selection in
  Go to Today. **Existing-enrollment UI recheck passed**; this does not cover
  fresh post-fix enrollment or the group invitation action.

The owner additionally reported that group invitations remain available,
personal Today entries persist after switching, and personal Goals calculations
are correct. These are owner-reported observations, not independently inspected
PM DOM or server-payload evidence. No personal values are included.

### Remaining acceptance and release gates

- Independently recheck the group invitation action and fresh post-fix enrollment
  on Preview; owner-reported group availability does not replace that evidence.
- Complete outstanding refresh/account-switch, navigation and eligible
  weigh-in-destination acceptance. Partial UI checks do not complete acceptance.
- The connected rollback-only harness passed before and after the guarded ACL
  correction. Remote permission correction is applied and verified; the inverse
  remains unexecuted and is reserved for an approved recovery decision if needed.
- Review migration lineage separately; schema/data recovery rehearsal and
  production/main authorization retain their separate gates. Never request
  passwords/keys or use browser observations as SQL/RLS proof.
- Follow-ups #228 (scroll-wheel input changes) and #229 (per-page challenge tabs)
  are recorded separately; neither is started or included in this PR.

## Recovery gates

Revert the application before considering schema rollback. The checked-in
guarded rollback aborts if any personal challenges exist: dropping the kind
would erase their privacy classification. Do not delete or reclassify existing
personal rows to bypass that guard. Preserve them via reviewed restoration or
forward repair, with the owner choosing the recovery route. Schema/data
backup/restore rehearsal, the remaining connected browser matrix and production
authorization remain pending; the passing rollback-only SQL checks and code/CI
success alone are not release approval.

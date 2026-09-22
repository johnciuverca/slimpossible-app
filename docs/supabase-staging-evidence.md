# Supabase staging evidence

This file records redacted evidence for Issue #143. It does not claim that
database migrations have executed.

## 2026-09-18 — activity workflow

- Workflow: [Supabase activity check](https://github.com/johnciuverca/slimpossible-app/actions/workflows/supabase-activity.yml)
- Run: [35334362968](https://github.com/johnciuverca/slimpossible-app/actions/runs/35334362968)
- Result: **blocked before request**
- Redacted reason: `SUPABASE_URL` was present, but `SUPABASE_ANON_KEY` was empty
  in the GitHub Actions configuration check.
- No health request was made and no response body was logged.

## 2026-09-18 — activity workflow rerun

- Run: [35335247840](https://github.com/johnciuverca/slimpossible-app/actions/runs/35335247840)
- Result: **blocked before network response**
- Redacted reason: both secrets passed the presence check, but `curl` rejected
  the configured `SUPABASE_URL` as malformed input.
- No HTTP status or response body was received or logged.

## 2026-09-18 — activity workflow success

- Run: [35335643126](https://github.com/johnciuverca/slimpossible-app/actions/runs/35335643126)
- Result: **verified live read-only activity check**
- The workflow completed successfully after the owner corrected the URL
  configuration.
- This verifies only the configured Auth health request; it does not verify
  migrations, tables, constraints, RLS, or application persistence.

## 2026-09-18 — owner-reported migration execution

- Environment: authorized empty/non-production Supabase project, ref
  `xtpbjhdzerdgaaxnsbtu`.
- `20260917000000_create_core_schema.sql`: **owner reported success**.
- `20260917000001_add_rls_policies.sql`: **owner reported success**.
- Supabase Table Editor reportedly shows `public.profiles`,
  `public.challenges`, `public.participants`, and `public.weigh_ins`.
- No passwords, privileged keys, secret values, response bodies, or row data
  were shared. This is recorded as owner-reported evidence, not an independent
  SQL-session observation.

## Pending live evidence

- The read-only activity check is verified live. The original schema and base
  policy migrations remain recorded as owner-reported evidence above; the
  Issue #146 hardening and authorization behavior are independently verified
  in the live test path below.
- Local/preview project targeting and full authenticated application
  persistence flows remain **not verified live**.

## 2026-09-22 — Issue #146 authorization verification

- Environment: owner-approved disposable Supabase test path with three
  disposable auth users assigned in owner/member/unrelated creation order.
- Initial live audit: 17 of 19 checks passed. The two failures were member
  challenge-metadata visibility and owner reassignment after weigh-ins.
- Migration:
  `20260922000000_harden_rls_authorization.sql` — **executed successfully**
  in the Supabase SQL Editor.
- Final live SQL harness:
  `supabase/tests/rls_authorization.sql` — **19 of 19 checks passed**.
- Verified behavior: anonymous reads/writes denied; owners can read and write
  owned challenges and manage safe membership fields; members can read the
  required challenge metadata and their own weigh-ins; unrelated users cannot
  read or write another user's challenge, membership, or weigh-ins; owners
  cannot reassign a membership after private weigh-ins exist.
- Cleanup check: temporary challenge and profile fixtures were removed; the
  hardened policy, predicate, and trigger were present after execution.

No emails, user IDs, private rows, passwords, service-role keys, database
credentials, project tokens, or secret values were returned or recorded.

No passwords, service-role keys, database credentials, project tokens, or
secret values belong in this file or in issue/PR comments.

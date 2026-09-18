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

## Pending live evidence

- The read-only activity check is now verified live. Migration execution and
  database/RLS evidence remain pending.
- Owner must apply both checked-in migrations through the approved Supabase SQL
  Editor or authorized migration workflow and provide redacted success evidence.
- Tables, constraints, RLS policies, local/preview project targeting, and
  authenticated persistence/ownership flows remain **not verified live**.

No passwords, service-role keys, database credentials, project tokens, or
secret values belong in this file or in issue/PR comments.

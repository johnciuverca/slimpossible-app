# Supabase staging setup handoff

This document is a preparation checklist for Issue #143. It is not evidence
that a live project has been configured or migrated. No migration is run by CI
or by the browser build.

## Owner confirmation required before any migration

The owner must confirm that the selected Supabase project is disposable,
non-production, and contains no personal production data. If that is not true,
the owner must select or create a dedicated non-production test project. Do not
apply these migrations to production.

The owner must also confirm the service is acceptable under their existing
account and plan. Codex will not create an account, upgrade a plan, or provision
a paid service.

## Project settings

In the owner-managed test project:

1. Enable the Email provider under Authentication → Providers.
2. Choose whether email confirmation is required for the test run. If it is
   enabled, use a dedicated test mailbox and complete verification there.
3. Add the local and preview redirect URLs under Authentication → URL
   Configuration. The local callback is the app origin (for example
   `http://localhost:5173`); the preview callback must be the exact owner
   preview URL. Do not guess a production URL.
4. Apply, in order, the checked-in migrations:
   - `20260917000000_create_core_schema.sql`
   - `20260917000001_add_rls_policies.sql`

The owner should use the Supabase SQL Editor or an owner-approved migration
workflow and retain redacted execution evidence: project/environment name,
migration filenames, execution timestamp, and success/failure only. Never put
database passwords, service-role keys, access tokens, or populated environment
files in chat, source, logs, or issue comments.

## Browser and deployment configuration

For local or Vercel preview testing, the owner adds only these public browser
variables to the owner-managed environment:

```text
VITE_SUPABASE_URL=https://<test-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<test-project-anon-key>
```

The repository `.env.example` contains placeholders only. A service-role key,
database password, or project token must never be placed in a `VITE_` variable.
The owner separately decides whether the existing read-only activity workflow
should receive `SUPABASE_URL` and `SUPABASE_ANON_KEY` Actions secrets.

## Evidence still required

After owner setup, record separately whether each item is **verified live**,
**blocked**, or **not run**:

- both migrations succeed on the fresh test database;
- tables, constraints, and RLS policies exist;
- local and preview builds point at the intended test project;
- sign-up, verification, sign-in, refresh, sign-out, profile initialization,
  challenge/participant/weigh-in persistence, and ownership denial pass;
- the read-only `/auth/v1/health` activity check succeeds, if configured.

The health request is only an activity signal; it does not prove that a free
plan will never pause. Do not mark any live item complete from mocked tests or
from a build without the owner-run evidence.

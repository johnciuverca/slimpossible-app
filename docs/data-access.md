# Typed data access

Issue #119 adds the typed Supabase boundary under `src/data/supabase/`.

## Boundary

- `database.types.ts` is the maintained TypeScript contract for the tables and
  summary function created by migrations #117 and #118.
- `client.ts` creates a typed browser client only from
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. It never uses a password,
  service-role key, project token, or other privileged value.
- `repositories.ts` is the only current application-facing data-access module.
  It maps database `snake_case` rows to the existing domain `camelCase`
  models and returns explicit `success`, `empty`, or safe `error` results.
- Components do not import the Supabase SDK or call `.from()` directly.

The repositories currently expose read-oriented methods needed to establish the
boundary: owned challenge lookup/listing, participants for a challenge, and
weigh-ins for a participant. Challenge, participant, and weigh-in persistence
flows remain out of scope for Issue #119.

## Configuration

Repository tests inject a local fake HTTP response and do not contact Supabase.
For live behavior, the owner must copy `.env.example` to `.env.local` and add
the owner-created project's public URL and public anonymous key. No account,
password, service-role key, project token, dashboard change, or populated env
file is needed for this issue's tests, and `.env.local` must remain ignored.

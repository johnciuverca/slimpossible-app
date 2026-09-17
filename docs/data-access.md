# Typed data access

Issues #119 and #120 provide the typed Supabase and persistence boundary under
`src/data/`.

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

The repositories now expose challenge and participant create/read/update
methods for Issue #120, plus weigh-in create/read/update/upsert methods for
Issue #121. The weigh-in upsert uses the participant/calendar-date uniqueness
rule, so correcting a submitted date replaces that record instead of creating
a duplicate.

Loaded weigh-ins remain ordinary domain records for the existing Chapter 5,
6, and 9 models. Those models continue to compare consecutive Sundays,
consider only participants with both submitted records, recalculate whenever
the loaded list changes (including late entries), and preserve shared ties plus
loss, maintenance, and gain goal progress.

When public Supabase configuration is missing, the setup, enrollment, and
weigh-in pages use the same repository-shaped interface backed by browser local
storage. This keeps the local MVP usable and lets saved local data survive
refresh. When public configuration exists but there is no real Supabase
session/user ID, the UI clearly reports remote persistence as unavailable and
does not claim that a save succeeded.

## Configuration

Repository tests inject a local fake HTTP response and do not contact Supabase.
For live behavior, the owner must copy `.env.example` to `.env.local` and add
the owner-created project's public URL and public anonymous key. No account,
password, service-role key, project token, dashboard change, or populated env
file is needed for this issue's tests, and `.env.local` must remain ignored.

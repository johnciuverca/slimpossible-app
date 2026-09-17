# Database schema

Issue #117 adds the first version-controlled Supabase migration at
`supabase/migrations/20260917000000_create_core_schema.sql`.

## Tables and relationships

- `profiles` stores the application profile identity for a Supabase Auth user.
  Its `id` references `auth.users(id)`.
- `challenges` stores the challenge owner, creator, date range, optional target,
  lifecycle status, and timestamps.
- `participants` is the challenge membership record. Each membership connects
  one profile to one challenge and stores the participant's display name,
  lifecycle status, starting weight, and target weight. Both weights must be
  positive, while the target may be lower than, equal to, or higher than the
  starting weight to support loss, maintenance, and gain goals, including
  normal day-to-day fluctuations.
- `weigh_ins` stores one dated weight record for a participant. Its unique
  `(participant_id, recorded_date)` constraint prevents duplicate same-day
  records.

The foreign-key path is:

```text
auth.users -> profiles -> challenges
                     └-> participants -> weigh_ins
```

## Integrity rules

The migration rejects blank names, non-positive weights, invalid challenge date
ranges, invalid lifecycle statuses, active memberships without `joined_at`,
duplicate challenge/profile memberships, and duplicate participant/date
weigh-ins. Indexes support owner lookups, challenge membership/status queries,
and date-based weekly weigh-in calculations.

There is no demo data in the migration. Row-level security, policies, typed
repositories, persistence flows, activity checks, and application-side
timestamps remain separate concerns from the schema migration.

## Applying it later

The project owner can apply the migration to the owner-created Supabase project
using the team's approved Supabase CLI workflow. This issue does not require a
Supabase password, service-role key, project token, dashboard change, or live
database connection. Never commit those values to the repository.

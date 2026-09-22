# Row-level security

Issue #118 adds
`supabase/migrations/20260917000001_add_rls_policies.sql` for the four
application tables created by Issue #117.

## Access decisions

| Table or surface                       | Authenticated access                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`                             | A user can read, create, and update only their own profile. There is no delete policy.                                                                                                                       |
| `challenges`                           | The owner can read, create, update, and delete their own challenges. A participant can read the metadata for their challenge. Creation and updates must keep both ownership fields tied to the current user. |
| `participants`                         | A participant can read their own membership. A challenge owner can read and manage memberships for their challenges.                                                                                         |
| `weigh_ins`                            | A participant can read and manage only their own weigh-ins. Owners do not receive raw weigh-ins or notes through table access.                                                                               |
| `get_challenge_progress_summary(uuid)` | A challenge owner can request aggregate counts and the latest recorded date for their challenge. The result contains no notes, weights, participant IDs, or display names.                                   |

Row-level security is enabled on every application table. Policies are granted
only to the `authenticated` role; anonymous requests and operations without a
matching policy are denied by default. The summary function is security
definer, validates ownership with `auth.uid()`, uses a fixed `search_path`,
and is executable only by authenticated users.

The policy migration does not add repositories, persistence flows, client
authentication, activity checks, or demo data. It also does not require a
password, service-role key, project token, populated environment file, or
dashboard action. The owner can apply it later through the approved Supabase
CLI workflow once the project is ready.

## Issue #146 hardening

The forward migration
`supabase/migrations/20260922000000_harden_rls_authorization.sql` adds the
smallest required authorization changes:

- Members can read the challenge metadata for challenges where they have a
  participant row. The membership predicate is a fixed-search-path,
  security-definer boolean function so the challenge and participant policies
  do not recurse into each other. It reveals no participant or weigh-in data.
- A participant's `user_id` cannot be changed after that participant has any
  weigh-ins. Owners can still update safe membership fields such as display
  name and status. Reassignment before private data exists remains possible;
  reassignment after weigh-ins requires a new membership instead of exposing
  the old member's history.

The executable authorization harness at
`supabase/tests/rls_authorization.sql` uses three disposable test users in
owner/member/unrelated creation order, runs inside temporary fixtures, and
returns only check names and pass/fail details. It must be run in the
approved non-production SQL Editor as `postgres`; its output is not a
substitute for approving the test environment.

The repository contract test checks that all four tables enable RLS, the
expected policy families exist, and the aggregate function does not select
raw weight or note fields. A live authorization test still requires a
Supabase project and authenticated test users, which are intentionally outside
this issue.

# Issue 14.6: provisional group leader rollout

The provisional result is a separate, read-only RPC. Apply
`20260925000000_add_provisional_group_leader_summary.sql` to the approved
staging project only after reviewing the migration and confirming the project
reference. Do not apply it to production as part of this PR.

In staging, sign in as an active participant in a multi-member challenge and
check Progress for the selected challenge. Confirm the exact previous-Sunday
baseline, current Monday–Sunday window (including Sunday), active/eligible
counts, ties, and that late or corrected saved weigh-ins update the provisional
display after Refresh. Check missing baselines/current-week records, a
single-member challenge, invited/removed membership, and a signed-out session.
Confirm that the browser receives only names, saved comparison dates, counts,
and the state—not weights, weigh-in history, or notes. The final weekly-winner
view should continue to use its existing Sunday-to-Sunday calculation.

The rollback-only SQL authorization harness is
`supabase/tests/group_progress_authorization.sql`. Run it only in the approved
non-production project after migrations, with exactly three disposable auth
users as described in its header; it is not run by CI and was not run as part
of this PR. Production rollout requires a separate approval, verified project
reference, migration application, and production smoke check.

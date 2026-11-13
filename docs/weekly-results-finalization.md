# Weekly group results

Weekly awards compare explicitly shared, actual weigh-ins recorded on two consecutive Sundays. A member needs both Sunday records. Missing values are not interpolated or extrapolated. Active member counts, members with a current-Sunday record, and members eligible across both Sundays are reported separately.

The provisional result locks Sunday at 20:00 Europe/Bucharest. Source writes acquire the same challenge/Sunday advisory lock before the database samples the gate. A transaction admitted before the cutoff may finish after it; finalization waits for that transaction and snapshots its committed state. Writes admitted at or after the cutoff cannot change that Sunday. Multiple scopes are locked in a stable order.

The private candidate tables hold only challenge/Sunday/member identity, display name, active state, and actual shared weight. The lazy finalizer writes one immutable result and its winners. Later source edits cannot alter an award. A competitive award requires at least two eligible members; a sole eligible member and a challenge with one active participant receive no competitive win.

The migration does not initialize the rollout. The restricted service-role initializer requires a future effective Sunday and seeds each existing group's finite Sunday horizon. New groups are seeded by a database trigger. Historical results before the selected effective Sunday continue to use the existing actual shared Sunday calculation and remain read-only; no award backfill occurs.

## Local verification

Run `supabase/tests/run_local_group_weekly_results.sh` to create a disposable PostgreSQL cluster, apply the migrations, check the Bucharest DST boundaries and strict cutoff, verify private snapshots and immutable awards, and exercise deterministic multi-scope locking. The script uses only a local Unix socket and does not configure logical replication or scheduled jobs.

This local proof does not initialize staging or production and does not establish hosted SQL acceptance. The rollout remains disabled until an owner schedules the service-role initializer for an approved future Sunday. Retention and deletion policy remain owner decisions before hosted activation.

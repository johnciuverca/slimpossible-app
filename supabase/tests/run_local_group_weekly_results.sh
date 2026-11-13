#!/usr/bin/env bash
# LOCAL ONLY: disposable PostgreSQL cluster on a Unix socket; no logical slots.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-weekly-results.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale >"$task_cluster/init.log"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$task_cluster"' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" \
  -o "-k $task_cluster/socket -p 55439 -c listen_addresses=''" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55439 -U postgres -d postgres)
cd "$task_root"
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  [[ "$task_migration" == *20261026000000_profile_avatars.sql ]] && continue
  "${task_psql[@]}" -f "$task_migration" >/dev/null
done
"${task_psql[@]}" -f supabase/tests/group_weekly_results.sql

# Callers can submit multiple scopes in different input orders; both must lock
# the same deterministic order and complete without a deadlock.
task_scopes='[{"challenge_id":"40400000-0000-4000-8000-000000000001","sunday":"2026-11-08"},{"challenge_id":"40400000-0000-4000-8000-000000000001","sunday":"2026-11-15"}]'
task_reverse_scopes='[{"challenge_id":"40400000-0000-4000-8000-000000000001","sunday":"2026-11-15"},{"challenge_id":"40400000-0000-4000-8000-000000000001","sunday":"2026-11-08"}]'
"${task_psql[@]}" -c "begin; select public._group_weekly_lock_scopes('$task_scopes'::jsonb); select pg_sleep(0.25); commit" >"$task_cluster/lock-a.log" 2>&1 &
task_lock_a=$!
sleep 0.05
"${task_psql[@]}" -c "begin; select public._group_weekly_lock_scopes('$task_reverse_scopes'::jsonb); commit" >"$task_cluster/lock-b.log" 2>&1 &
task_lock_b=$!
if ! wait "$task_lock_a"; then cat "$task_cluster/lock-a.log" "$task_cluster/lock-b.log" >&2; exit 1; fi
if ! wait "$task_lock_b"; then cat "$task_cluster/lock-a.log" "$task_cluster/lock-b.log" >&2; exit 1; fi
printf 'PASS local weekly result migration, cutoff, immutability and lock-order proof\n'

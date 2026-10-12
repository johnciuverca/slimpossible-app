#!/usr/bin/env bash
# LOCAL ONLY: fresh disposable PostgreSQL, Unix socket only, no hosted access.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-257-target-change.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" -o "-k $task_cluster/socket -p 55435 -c listen_addresses=''" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55435 -U postgres -d postgres)
cd "$task_root"
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  "${task_psql[@]}" -f "$task_migration"
done
"${task_psql[@]}" -f supabase/tests/target_change_authorization.sql
printf 'PASS local target-change authorization; disposable cluster retained at %s\n' "$task_cluster"

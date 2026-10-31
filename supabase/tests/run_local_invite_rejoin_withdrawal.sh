#!/usr/bin/env bash
# LOCAL ONLY: apply migrations to a fresh disposable PostgreSQL cluster.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-invite-rejoin.XXXXXX)"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null 2>&1 || true' EXIT
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" -o "-k $task_cluster/socket -p 55439 -c listen_addresses=''" -w start
cd "$task_root"
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55439 -U postgres -d postgres)
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  # Supabase Storage is not part of the local Auth shim; avatar storage setup
  # is unrelated to invite acceptance and requires the hosted storage schema.
  [[ "$task_migration" == *20261026000000_profile_avatars.sql ]] && continue
  "${task_psql[@]}" -f "$task_migration"
done
"${task_psql[@]}" -f supabase/tests/invite_rejoin_withdrawal_authorization.sql

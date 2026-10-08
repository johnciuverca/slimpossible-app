#!/usr/bin/env bash
# LOCAL ONLY: native disposable PostgreSQL, Unix socket, no TCP listener.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_cluster="$(mktemp -d /private/tmp/slimpossible-211-chart.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" -o "-k $task_cluster/socket -p 55434 -c listen_addresses=''" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55434 -U postgres -d postgres)
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  "${task_psql[@]}" -f "$task_migration"
done
for task_harness in group_chart_history_authorization personal_weigh_in_authorization; do
  sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
      -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
      -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    "supabase/tests/$task_harness.sql" | "${task_psql[@]}"
done
"${task_psql[@]}" -f supabase/rollback/20261009000000_add_group_chart_history.sql
"${task_psql[@]}" -c "do \$\$ begin
  if to_regprocedure('public.get_group_chart_history(uuid)') is not null
    or to_regprocedure('public.get_group_weigh_in_history(uuid)') is null then
    raise exception 'Additive chart rollback changed the legacy history contract.';
  end if;
end; \$\$;"
"${task_psql[@]}" -f supabase/migrations/20261009000000_add_group_chart_history.sql
printf 'PASS local chart history SQL and canonical ranking regression; retained cluster at %s\n' "$task_cluster"

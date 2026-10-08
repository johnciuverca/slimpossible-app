#!/usr/bin/env bash
# LOCAL ONLY: two fresh disposable PostgreSQL clusters; socket only, no TCP.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster=''
trap 'if [[ -n "$task_cluster" ]]; then "$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null; fi' EXIT
cd "$task_root"
for task_mode in clean upgrade defaults; do
  task_cluster="$(mktemp -d /private/tmp/slimpossible-210-eligibility.XXXXXX)"
  mkdir "$task_cluster/socket"
  "$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
  "$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" -o "-k $task_cluster/socket -p 55433 -c listen_addresses=''" -w start
  task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55433 -U postgres -d postgres)
  "${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
  for task_migration in supabase/migrations/*.sql; do
    if [[ "$task_mode" == defaults && ( "$task_migration" == *20261007000000_personal_weigh_ins.sql || "$task_migration" == *20261008000000_allow_draft_group_weigh_in_sharing.sql ) ]]; then
      continue
    fi
    if [[ "$task_mode" == upgrade && "$task_migration" == *20261008000000_allow_draft_group_weigh_in_sharing.sql ]]; then
      continue
    fi
    "${task_psql[@]}" -f "$task_migration"
  done
  if [[ "$task_mode" == upgrade ]]; then
    "${task_psql[@]}" -f supabase/tests/personal_weigh_in_draft_upgrade.sql
  fi
  if [[ "$task_mode" == defaults ]]; then
    "${task_psql[@]}" -c "set slimpossible.disposable_acl_fixture='true'" -f supabase/tests/personal_weigh_in_default_privileges.sql
  fi
  for task_harness in personal_weigh_in_authorization personal_weigh_in_group_eligibility; do
    sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
        -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
        -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
      "supabase/tests/$task_harness.sql" | "${task_psql[@]}"
  done
  "$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null
  printf 'PASS %s install; stopped local cluster retained at %s\n' "$task_mode" "$task_cluster"
  task_cluster=''
done

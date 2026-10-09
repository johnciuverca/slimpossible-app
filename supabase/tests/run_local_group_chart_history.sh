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
"${task_psql[@]}" -f supabase/tests/local_group_chart_collision_setup.sql
task_fingerprint() {
  "${task_psql[@]}" -At -c "select md5(coalesce(string_agg(row_data, '' order by row_data), '')) from (
    select 'profiles:' || to_jsonb(t)::text row_data from public.profiles t
    union all select 'challenges:' || to_jsonb(t)::text from public.challenges t
    union all select 'participants:' || to_jsonb(t)::text from public.participants t
    union all select 'entries:' || to_jsonb(t)::text from public.personal_weigh_ins t
    union all select 'shares:' || to_jsonb(t)::text from public.personal_weigh_in_group_shares t
  ) snapshots;"
}
task_before="$(task_fingerprint)"
task_chart_script() {
  sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
      -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
      -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    supabase/tests/group_chart_history_authorization.sql
}
task_chart_script | "${task_psql[@]}"
test "$task_before" = "$(task_fingerprint)"
# Abort after fixture correction/deletion/withdrawal, before final rollback.
# ON_ERROR_STOP disconnects the session; PostgreSQL rolls back the open transaction.
if task_chart_script | sed '/  if exists(select 1 from chart_checks/i\
  raise exception '\''Injected fixture failure'\'';' | "${task_psql[@]}" > "$task_cluster/expected-failure.log" 2>&1; then
  printf 'FAIL injected fixture error did not abort\n' >&2
  exit 1
fi
rg -q 'Injected fixture failure' "$task_cluster/expected-failure.log"
test "$task_before" = "$(task_fingerprint)"
printf 'PASS populated-date collisions and exact existing-state preservation after success and injected failure\n'
# Exhaust the bounded future-date candidates to exercise the pre-DML guard.
"${task_psql[@]}" -c "insert into public.personal_weigh_ins (user_id,recorded_date,weight_kg,note)
  select '00000000-0000-4000-8000-000000000002'::uuid,current_date+day_offset,75,'Synthetic occupied future date'
  from generate_series(1,365) day_offset on conflict (user_id,recorded_date) do nothing;"
task_before="$(task_fingerprint)"
if task_chart_script | "${task_psql[@]}" > "$task_cluster/expected-date-guard.log" 2>&1; then
  printf 'FAIL unavailable-date guard did not abort\n' >&2
  exit 1
fi
rg -q 'No unused fixture dates available' "$task_cluster/expected-date-guard.log"
test "$task_before" = "$(task_fingerprint)"
printf 'PASS exhausted fixture-date guard leaves exact existing state unchanged\n'
"${task_psql[@]}" -f supabase/rollback/20261009000000_add_group_chart_history.sql
"${task_psql[@]}" -c "do \$\$ begin
  if to_regprocedure('public.get_group_chart_history(uuid)') is not null
    or to_regprocedure('public.get_group_weigh_in_history(uuid)') is null then
    raise exception 'Additive chart rollback changed the legacy history contract.';
  end if;
end; \$\$;"
"${task_psql[@]}" -f supabase/migrations/20261009000000_add_group_chart_history.sql
printf 'PASS local chart history SQL and canonical ranking regression; retained cluster at %s\n' "$task_cluster"

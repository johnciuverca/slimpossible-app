#!/usr/bin/env bash
# LOCAL ONLY: a fresh disposable PostgreSQL cluster, Unix socket only.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-weekly-result.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null 2>&1 || true; rm -rf "$task_cluster"' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" \
  -o "-k $task_cluster/socket -p 55439 -c listen_addresses='' -c wal_level=logical -c max_replication_slots=5 -c max_slot_wal_keep_size=32MB" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55439 -U postgres -d postgres)
cd "$task_root"
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  [[ "$task_migration" == *20261026000000_profile_avatars.sql ]] && continue
  "${task_psql[@]}" -f "$task_migration"
done
"${task_psql[@]}" -f supabase/tests/group_weekly_result_consumer.sql
task_expected_log="$task_cluster/expected-failure.log"
"${task_psql[@]}" -c "begin; update public.personal_weigh_ins set weight_kg = 83 where id = '40400000-0000-4000-8000-000000000022'; select pg_sleep(0.25); commit" >"$task_cluster/source-update-delete.log" 2>&1 &
task_source_update=$!
sleep 0.05
"${task_psql[@]}" -c "delete from public.personal_weigh_in_group_shares where personal_weigh_in_id = '40400000-0000-4000-8000-000000000022' and challenge_id = '40400000-0000-4000-8000-000000000001'" >"$task_cluster/share-delete.log" 2>&1 &
task_share_delete=$!
if ! wait "$task_source_update"; then cat "$task_cluster/source-update-delete.log" >&2; exit 1; fi
if ! wait "$task_share_delete"; then cat "$task_cluster/share-delete.log" >&2; exit 1; fi
for task_pass in 1 2 3 4; do
  "${task_psql[@]}" -c 'set role service_role' \
    -c 'select public.persist_group_weekly_result_events()' \
    -c 'select public.ack_group_weekly_result_events()'
done
if [[ "$("${task_psql[@]}" -Atc "select payload ->> 'shared' from public.group_weekly_result_events where challenge_id = '40400000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000002' and payload ->> 'recorded_date' = (current_date - 1)::text order by commit_lsn desc, transaction_ordinal desc limit 1")" != false ]]; then
  echo 'ERROR: concurrent weigh-in update/share deletion left stale shared evidence' >&2
  exit 1
fi
"${task_psql[@]}" -c "begin; update public.personal_weigh_ins set weight_kg = 84 where id = '40400000-0000-4000-8000-000000000022'; select pg_sleep(0.25); commit" >"$task_cluster/source-update-insert.log" 2>&1 &
task_source_update=$!
sleep 0.05
"${task_psql[@]}" -c "insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id) values ('40400000-0000-4000-8000-000000000022', '40400000-0000-4000-8000-000000000001')" >"$task_cluster/share-insert.log" 2>&1 &
task_share_insert=$!
if ! wait "$task_source_update"; then cat "$task_cluster/source-update-insert.log" >&2; exit 1; fi
if ! wait "$task_share_insert"; then cat "$task_cluster/share-insert.log" >&2; exit 1; fi
for task_pass in 1 2 3 4; do
  "${task_psql[@]}" -c 'set role service_role' \
    -c 'select public.persist_group_weekly_result_events()' \
    -c 'select public.ack_group_weekly_result_events()'
done
if [[ "$("${task_psql[@]}" -Atc "select (payload ->> 'shared') = 'true' and (payload ->> 'weight_kg')::numeric = 84 from public.group_weekly_result_events where challenge_id = '40400000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000002' and payload ->> 'recorded_date' = (current_date - 1)::text order by commit_lsn desc, transaction_ordinal desc limit 1")" != t ]]; then
  echo 'ERROR: concurrent weigh-in update/share insertion failed to snapshot committed state' >&2
  exit 1
fi
"${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.capture_group_weekly_barrier()'
"${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.persist_group_weekly_result_events()' >"$task_cluster/worker-a.log" 2>&1 &
task_worker_a=$!
"${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.persist_group_weekly_result_events()' >"$task_cluster/worker-b.log" 2>&1 &
task_worker_b=$!
if ! wait "$task_worker_a"; then
  cat "$task_cluster/worker-a.log" "$task_cluster/worker-b.log" >&2
  exit 1
fi
if ! wait "$task_worker_b"; then
  cat "$task_cluster/worker-a.log" "$task_cluster/worker-b.log" >&2
  exit 1
fi
"${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.ack_group_weekly_result_events()'
if [[ "$("${task_psql[@]}" -Atc "select count(*) from public.group_weekly_result_events where event_kind = 'barrier'")" != 1 ]]; then
  echo 'ERROR: concurrent consumer workers duplicated or lost the barrier' >&2
  exit 1
fi
"${task_psql[@]}" -c 'alter table public.group_weekly_result_outbox add column unexpected_schema_change text' \
  -c 'select public.capture_group_weekly_barrier()'
if "${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.persist_group_weekly_result_events()' >"$task_expected_log" 2>&1; then
  echo 'ERROR: weekly consumer accepted outbox schema drift' >&2
  exit 1
fi
if ! grep -q 'Weekly outbox relation must have one column' "$task_expected_log"; then
  cat "$task_expected_log" >&2
  exit 1
fi
"${task_psql[@]}" -c "select pg_drop_replication_slot('slimpossible_group_weekly_results_v1')"
"${task_psql[@]}" -c "select * from pg_create_logical_replication_slot('slimpossible_group_weekly_results_v1', 'pgoutput')"
if "${task_psql[@]}" -c 'set role service_role' \
  -c 'select public.persist_group_weekly_result_events()' >"$task_expected_log" 2>&1; then
  echo 'ERROR: weekly consumer accepted an advanced recreated slot' >&2
  exit 1
fi
if ! grep -q 'Slot advanced beyond durable evidence' "$task_expected_log"; then
  cat "$task_expected_log" >&2
  exit 1
fi
printf 'PASS local weekly result consumer proof; disposable cluster removed on exit\n'

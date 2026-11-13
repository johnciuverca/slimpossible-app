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

# Exercise the real authenticated save RPC with two users selecting the same
# challenges in opposite orders. The RPC and its source-row triggers must sort
# their row and challenge locks consistently under actual concurrent writes.
task_rpc_sunday="$("${task_psql[@]}" -Atc "select (clock_timestamp() at time zone 'Europe/Bucharest')::date - extract(dow from clock_timestamp() at time zone 'Europe/Bucharest')::integer - 14")"
task_save_a="set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false); select id from public.save_personal_weigh_in('40400000-0000-4000-8000-000000000022', '$task_rpc_sunday', 78, null, array['40400000-0000-4000-8000-000000000001'::uuid, '40400000-0000-4000-8000-000000000002'::uuid]);"
task_save_b="set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false); select id from public.save_personal_weigh_in('40400000-0000-4000-8000-000000000024', '$task_rpc_sunday', 83, null, array['40400000-0000-4000-8000-000000000002'::uuid, '40400000-0000-4000-8000-000000000001'::uuid]);"
"${task_psql[@]}" -c "$task_save_a" >"$task_cluster/save-a.log" 2>&1 &
task_save_a_pid=$!
"${task_psql[@]}" -c "$task_save_b" >"$task_cluster/save-b.log" 2>&1 &
task_save_b_pid=$!
if ! wait "$task_save_a_pid"; then cat "$task_cluster/save-a.log" "$task_cluster/save-b.log" >&2; exit 1; fi
if ! wait "$task_save_b_pid"; then cat "$task_cluster/save-a.log" "$task_cluster/save-b.log" >&2; exit 1; fi
task_share_count="$("${task_psql[@]}" -Atc "select count(*) from public.personal_weigh_in_group_shares where personal_weigh_in_id in ('40400000-0000-4000-8000-000000000022', '40400000-0000-4000-8000-000000000024') and challenge_id in ('40400000-0000-4000-8000-000000000001', '40400000-0000-4000-8000-000000000002')")"
[[ "$task_share_count" == 4 ]] || { printf 'Unexpected concurrent RPC share rows: %s\n' "$task_share_count" >&2; exit 1; }
printf 'PASS local weekly snapshots, chronology, membership episodes, cutoff, immutable awards and concurrent RPC lock ordering\n'

#!/usr/bin/env bash
# LOCAL ONLY; creates a fresh isolated native PostgreSQL cluster, no TCP listener.
# No remote URLs, production credentials or external accounts are accepted.
set -euo pipefail
task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-acl-local.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
trap '"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" \
  -o "-k $task_cluster/socket -p 55432 -c listen_addresses=''" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55432 -U postgres -d postgres)
cd "$task_root"
"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql
for task_migration in supabase/migrations/*.sql; do
  if [[ "$task_migration" != *20261005000001_converge_function_execute_grants.sql ]]; then
    "${task_psql[@]}" -f "$task_migration"
  fi
done
"${task_psql[@]}" -f supabase/tests/local_acl_fixture.sql
"${task_psql[@]}" -f supabase/tests/group_weigh_in_history_authorization.sql
run_history_harness() {
  sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
      -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
      -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    supabase/tests/group_weigh_in_history_staging_authorization.sql | "${task_psql[@]}"
}
run_history_harness
if "${task_psql[@]}" -f supabase/tests/group_weigh_in_history_staging_authorization.sql; then
  printf 'ERROR: unfilled group-history identity placeholders were accepted\n' >&2
  exit 1
fi
if sed -e 's/REPLACE_OWNER_UUID/not-a-uuid/' \
       -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/' \
       -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/' \
    supabase/tests/group_weigh_in_history_staging_authorization.sql | "${task_psql[@]}"; then
  printf 'ERROR: malformed group-history identity was accepted\n' >&2
  exit 1
fi
if sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    supabase/tests/group_weigh_in_history_staging_authorization.sql | "${task_psql[@]}"; then
  printf 'ERROR: duplicate group-history identities were accepted\n' >&2
  exit 1
fi
if sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
       -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000088/g' \
    supabase/tests/group_weigh_in_history_staging_authorization.sql | "${task_psql[@]}"; then
  printf 'ERROR: nonexistent group-history identity was accepted\n' >&2
  exit 1
fi
"${task_psql[@]}" -f supabase/rollback/20261006000000_add_opt_in_group_weigh_in_history.sql
"${task_psql[@]}" -c "do \$verify\$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'weigh_ins' and column_name = 'share_with_group')
     or to_regprocedure('public.get_group_weigh_in_history(uuid)') is not null then
    raise exception 'Issue 16.2 rollback left part of the delta installed';
  end if;
  if (select count(*) from public.weigh_ins where note = 'Preserve existing note') <> 1 then
    raise exception 'Issue 16.2 rollback changed a pre-existing weigh-in';
  end if;
end; \$verify\$"
"${task_psql[@]}" -f supabase/migrations/20261006000000_add_opt_in_group_weigh_in_history.sql
"${task_psql[@]}" -c "do \$verify\$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'weigh_ins' and column_name = 'share_with_group')
     or to_regprocedure('public.get_group_weigh_in_history(uuid)') is null then
    raise exception 'Issue 16.2 forward migration did not restore the complete delta';
  end if;
  if (select count(*) from public.weigh_ins where note = 'Preserve existing note' and not share_with_group) <> 1 then
    raise exception 'Issue 16.2 re-forward changed a pre-existing row or made it public';
  end if;
end; \$verify\$"
run_history_harness
run_harness() {
  sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
      -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
      -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    supabase/tests/personal_group_challenges_authorization.sql | "${task_psql[@]}"
}
"${task_psql[@]}" -v phase=before -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -f supabase/tests/function_execute_acl_audit.sql > "$task_cluster/before-acl.txt"
run_harness
if "${task_psql[@]}" -f supabase/tests/personal_group_challenges_authorization.sql; then
  printf 'ERROR: unfilled identity placeholders were accepted\n' >&2
  exit 1
fi
if sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
    supabase/tests/personal_group_challenges_authorization.sql | "${task_psql[@]}"; then
  printf 'ERROR: duplicate identity inputs were accepted\n' >&2
  exit 1
fi
if sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
       -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
       -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000088/g' \
    supabase/tests/personal_group_challenges_authorization.sql | "${task_psql[@]}"; then
  printf 'ERROR: nonexistent identity was accepted\n' >&2
  exit 1
fi
"${task_psql[@]}" -v phase=before -f supabase/tests/local_acl_assertions.sql
# Model intervening drift and prove preflight fails before any partial revocation.
"${task_psql[@]}" -c 'grant execute on function public.is_challenge_member(uuid) to PUBLIC'
if "${task_psql[@]}" -f supabase/migrations/20261005000001_converge_function_execute_grants.sql; then
  printf 'ERROR: forward migration accepted unexpected PUBLIC access\n' >&2
  exit 1
fi
"${task_psql[@]}" -c 'revoke execute on function public.is_challenge_member(uuid) from PUBLIC'
"${task_psql[@]}" -v phase=recovery -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -f supabase/migrations/20261005000001_converge_function_execute_grants.sql
"${task_psql[@]}" -v phase=forward -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -f supabase/tests/function_execute_acl_audit.sql > "$task_cluster/after-acl.txt"
run_harness
if "${task_psql[@]}" -c "set role anon; select public.is_challenge_member('10000000-0000-4000-8000-000000000001')"; then
  printf 'ERROR: anonymous membership helper execution was allowed\n' >&2
  exit 1
fi
"${task_psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false); do \$\$ begin if not public.is_challenge_member('10000000-0000-4000-8000-000000000001') then raise exception 'Authenticated membership helper must remain usable.'; end if; end; \$\$;"
"${task_psql[@]}" -c "set role anon; select * from public.preview_challenge_invite('invalid-local-read-only-probe')"
"${task_psql[@]}" -f supabase/tests/local_acl_default_behavior.sql
# CREATE OR REPLACE preserves corrected direct ACLs; inherited defaults must not
# silently restore anon membership-helper execution on an existing function.
"${task_psql[@]}" -c "select pg_get_functiondef('public.is_challenge_member(uuid)'::regprocedure)" -t -A | "${task_psql[@]}"
"${task_psql[@]}" -v phase=forward -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -c 'grant execute on function public.is_challenge_member(uuid) to PUBLIC'
if "${task_psql[@]}" -f supabase/rollback/20261005000001_converge_function_execute_grants.sql; then
  printf 'ERROR: recovery accepted unexpected PUBLIC access\n' >&2
  exit 1
fi
"${task_psql[@]}" -c 'revoke execute on function public.is_challenge_member(uuid) from PUBLIC'
"${task_psql[@]}" -v phase=forward -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -f supabase/rollback/20261005000001_converge_function_execute_grants.sql
"${task_psql[@]}" -v phase=recovery -f supabase/tests/local_acl_assertions.sql
"${task_psql[@]}" -f supabase/tests/function_execute_acl_audit.sql > "$task_cluster/recovery-acl.txt"
run_harness
"${task_psql[@]}" -v phase=recovery -f supabase/tests/local_acl_assertions.sql
printf 'Local verification passed; stopped cluster and evidence retained at %s\n' "$task_cluster"

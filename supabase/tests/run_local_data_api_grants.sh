#!/usr/bin/env bash
# LOCAL ONLY: exercise the pending #247 migration set with no automatic
# public-table or sequence grants. Uses a fresh socket-only PostgreSQL cluster.
set -euo pipefail

task_pg_bin="${SLIMPOSSIBLE_LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
task_root="$(git rev-parse --show-toplevel)"
task_cluster="$(mktemp -d /private/tmp/slimpossible-data-api-grants.XXXXXX)"
mkdir "$task_cluster/socket"
"$task_pg_bin/initdb" -D "$task_cluster/data" -U postgres -A trust --no-locale > "$task_cluster/init.log"
trap 'if [[ -n "$task_cluster" ]]; then "$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null 2>&1 || true; fi' EXIT
"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -l "$task_cluster/server.log" \
  -o "-k $task_cluster/socket -p 55446 -c listen_addresses=''" -w start
task_psql=("$task_pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$task_cluster/socket" -p 55446 -U postgres -d postgres)
cd "$task_root"

"${task_psql[@]}" -f supabase/tests/local_auth_compatibility_setup.sql

task_baseline_migrations=(
  supabase/migrations/20260917000000_create_core_schema.sql
  supabase/migrations/20260917000001_add_rls_policies.sql
  supabase/migrations/20260922000000_harden_rls_authorization.sql
  supabase/migrations/20260922000001_add_secure_challenge_invites.sql
  supabase/migrations/20260924000000_add_privacy_safe_group_progress.sql
)
for task_migration in "${task_baseline_migrations[@]}"; do
  "${task_psql[@]}" -f "$task_migration"
done

# Snapshot existing-table ACL/RLS state, then emulate the post-rollout default:
# future tables/sequences get no implicit Data API privileges. Altering default
# privileges must not rewrite grants already stored on existing relations.
"${task_psql[@]}" <<'SQL'
create schema local_test;
create table local_test.existing_public_table_access_before as
select relation.relname, relation.relacl, relation.relrowsecurity,
  relation.relforcerowsecurity
from pg_class as relation
join pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public' and relation.relkind in ('r', 'p');

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from pg_default_acl as defaults
    join pg_namespace as namespace on namespace.oid = defaults.defaclnamespace
    cross join lateral aclexplode(defaults.defaclacl) as privilege
    where namespace.nspname = 'public'
      and defaults.defaclobjtype in ('r', 'S')
      and privilege.grantee in (
        0,
        'anon'::regrole::oid,
        'authenticated'::regrole::oid,
        'service_role'::regrole::oid
      )
  ) then
    raise exception 'API-role table/sequence default grants remain enabled';
  end if;
end;
$$;
SQL

task_pending_migrations=(
  supabase/migrations/20260925000000_add_provisional_group_leader_summary.sql
  supabase/migrations/20261005000000_add_personal_group_challenge_kinds.sql
  supabase/migrations/20261005000001_converge_function_execute_grants.sql
  supabase/migrations/20261006000000_add_opt_in_group_weigh_in_history.sql
  supabase/migrations/20261007000000_personal_weigh_ins.sql
  supabase/migrations/20261008000000_allow_draft_group_weigh_in_sharing.sql
  supabase/migrations/20261009000000_add_group_chart_history.sql
  supabase/migrations/20261012000000_add_group_target_change_milestones.sql
  supabase/migrations/20261012100000_add_group_member_progress_projection.sql
  supabase/migrations/20261013000000_correct_own_enrollment_starting_weight.sql
  supabase/migrations/20261016000000_require_active_challenge_membership.sql
  supabase/migrations/20261018000000_allow_group_owners_to_view_summaries.sql
)
for task_migration in "${task_pending_migrations[@]}"; do
  "${task_psql[@]}" -f "$task_migration"
done

"${task_psql[@]}" -f supabase/tests/data_api_grants_no_auto.sql

for task_harness in \
  personal_weigh_in_authorization \
  starting_weight_correction_authorization \
  group_member_progress_projection_authorization; do
  if [[ "$task_harness" == personal_weigh_in_authorization ]]; then
    sed -e 's/REPLACE_OWNER_UUID/00000000-0000-4000-8000-000000000001/g' \
        -e 's/REPLACE_MEMBER_UUID/00000000-0000-4000-8000-000000000002/g' \
        -e 's/REPLACE_OUTSIDER_UUID/00000000-0000-4000-8000-000000000003/g' \
      "supabase/tests/$task_harness.sql" | "${task_psql[@]}"
  else
    "${task_psql[@]}" -f "supabase/tests/$task_harness.sql"
  fi
done

"$task_pg_bin/pg_ctl" -D "$task_cluster/data" -m fast stop >/dev/null
printf 'PASS no-auto-grants migration/access audit; disposable cluster retained at %s\n' "$task_cluster"
task_cluster=''

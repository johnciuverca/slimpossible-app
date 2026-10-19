# Persistent staging and production release workflow

This guide describes the repository path from a feature branch through the
persistent staging branch to production main. It does not create staging,
change Vercel/Supabase settings, copy database contents, or run migrations.
Only an owner performs dashboard setup and the explicitly approved database
steps below.

## One-time owner setup after this PR is merged

The owner creates staging from the then-current main tip. Do not base it on an
old feature branch. The owner then confirms the Vercel Production Branch
remains main and that Production still points to the production Supabase
project.

The app reads exactly two public browser variables:

| Vercel variable        | Value in the staging branch Preview scope               |
| ---------------------- | ------------------------------------------------------- |
| VITE_SUPABASE_URL      | Project URL from the dedicated staging Supabase project |
| VITE_SUPABASE_ANON_KEY | That staging project's public anon/publishable key      |

In Vercel Project Settings → Environment Variables, add both variables as
Preview variables scoped to the Git branch staging. The currently
owner-reported variables are scoped to codex/13-6-implementation; those
branch-specific values do not configure staging. Add the two new branch
scopes without changing the existing codex/13-6-implementation, general
Preview, Development, or Production values. Never put a service-role key,
database password, access token, or connection string in a VITE_ variable.

Use Vercel's stable branch-specific URL for staging (confirm the assigned
domain in Project → Settings → Domains after the owner creates the branch).
Based on the project's current generated-domain pattern, it is expected to be
https://slimpossible-app-git-staging-cvc10.vercel.app. In the staging
Supabase project only, set Authentication → URL Configuration's Site URL to
that verified staging origin and add its exact app redirect pattern:

    https://slimpossible-app-git-staging-cvc10.vercel.app/**

If Vercel assigns a different stable branch URL or the owner binds a staging
domain, use that verified origin instead. Do not add a broad wildcard for all
Vercel previews to Production's Supabase Auth configuration. Supabase supports
wildcards for preview redirect paths; keep this allowlist limited to the
staging project and the stable staging origin.

Keep staging test users and database contents separate from production. Do not
copy staging rows, accounts, or credentials into production.

## Code promotion

1. After staging exists, branch features from the latest staging tip. Open
   feature PRs against staging. The Quality workflow runs for PRs and pushes
   to both staging and main; Vercel deploys the staging branch as a Preview
   with the branch-scoped staging variables.
2. Merge only reviewed feature PRs into staging. Test the exact deployed
   candidate against the separate staging Supabase project.
3. When the owner approves a release candidate, open one release PR from
   staging to main. Review its code and migration filenames against the
   tested staging SHA. Vercel's Production deployment remains tied to main.
4. Merge the release PR with a merge commit. Do not squash or rebase the
   staging-to-main release: the merge commit records the staging tip as an
   ancestor of main.
5. After release, open a main → staging sync PR and merge it with a merge
   commit. This makes the released main tip an ancestor of staging before
   the next feature cycle. Do not force-push, reset, or recreate the persistent
   branch. The next release then contains only commits made after this sync,
   rather than replaying the previous release.

If the repository does not offer an ancestry-preserving merge option for the
release or sync PR, stop and ask the owner to resolve the merge policy; do not
substitute a squash merge or force-push.

## Database migration promotion

Migrations are not part of the Quality workflow. Neither a feature-branch
push nor a Vercel deployment runs supabase db push. The existing
supabase-activity.yml check only calls the Auth health endpoint; it is not a
migration job. This PR adds no database credentials, GitHub Environments, or
automated migration steps.

The release-gate inventory below is for the exact staging candidate checked on
2026-10-19, `00fcf280bd3be0d54ea3497679d23e80633207d4`. It contains 17
timestamp-ordered migration files. This snapshot is not a claim that the
main-based documentation branch contains those SQL files, that a hosted
project has applied them, or that its migration ledger has been reconciled.
Several migrations define SECURITY DEFINER functions or change grants/policies;
review their exact privileges and run the relevant `supabase/tests/`
authorization checks on the dedicated staging project. Do not treat these as
routine unreviewed SQL.

The candidate migration set is:

- `20260917000000_create_core_schema.sql`
- `20260917000001_add_rls_policies.sql`
- `20260922000000_harden_rls_authorization.sql`
- `20260922000001_add_secure_challenge_invites.sql`
- `20260924000000_add_privacy_safe_group_progress.sql`
- `20260925000000_add_provisional_group_leader_summary.sql`
- `20261005000000_add_personal_group_challenge_kinds.sql`
- `20261005000001_converge_function_execute_grants.sql`
- `20261006000000_add_opt_in_group_weigh_in_history.sql`
- `20261007000000_personal_weigh_ins.sql`
- `20261008000000_allow_draft_group_weigh_in_sharing.sql`
- `20261009000000_add_group_chart_history.sql`
- `20261012000000_add_group_target_change_milestones.sql`
- `20261012100000_add_group_member_progress_projection.sql`
- `20261013000000_correct_own_enrollment_starting_weight.sql`
- `20261016000000_require_active_challenge_membership.sql`
- `20261018000000_allow_group_owners_to_view_summaries.sql`

Checked-in rollback scripts cover only a subset of this candidate's migrations
(8 of 17): `20261005000000`, `20261005000001`, `20261006000000`,
`20261007000000` (RPC compatibility restore), `20261009000000`,
`20261012100000`, `20261013000000`, and `20261018000000`. No matching rollback
file is checked in for `20261008000000`, `20261012000000`,
`20261016000000`, or the initial core migrations. A present rollback script
is not an instruction to run it: inspect its preconditions and data effects,
preserve the migration ledger, and prefer the reviewed forward-compatible
recovery plan. Before any staging or production migration, verify a recoverable
backup/restore path and the exact remote migration history. No remote migration
state is asserted by this inventory.

For each candidate, an owner uses the checked-out, reviewed migration set and
explicitly targets each project. The following are operator-run examples;
the URL variables are supplied privately by the owner and their values must
never be committed or logged:

    supabase migration list --db-url "$STAGING_DB_URL"
    supabase db push --db-url "$STAGING_DB_URL" --dry-run
    # After confirming the project and exact pending filenames:
    supabase db push --db-url "$STAGING_DB_URL"

Run the staging commands only after reviewing the SQL and confirming the
target is the dedicated staging project. Stop if remote migration history
differs from the checked-in timestamps or the dry-run lists unexpected files.
Do not use migration repair, reset, or seed as a shortcut for unexplained
drift. Verify the migration result and relevant authorization tests before
approving the staging candidate. Do not copy staging data to production.

Production is a separate, deliberate owner gate, not a CI action:

1. After the release PR has been reviewed, compare production's migration
   history with the reviewed main migration set and inspect a dry-run using
   a separately held production database URL:

       supabase migration list --db-url "$PRODUCTION_DB_URL"
       supabase db push --db-url "$PRODUCTION_DB_URL" --dry-run

2. Confirm a recoverable production backup/restore path, identify the exact
   pending migration filenames, and get explicit owner approval for this
   production change. A normal push, PR, CI run, or Vercel deployment is not
   approval.
3. For reviewed backward-compatible schema expansion that the new app needs,
   the owner applies only the approved migrations to production before merging
   the release PR, then verifies success before allowing the Vercel release.
   For a contract/destructive change, use a separate expand/contract plan and
   do not remove the old schema until released code no longer depends on it.
4. Only after the owner gate succeeds should the release PR merge and trigger
   the main production deployment. If a migration or check fails, stop the
   release; do not auto-repair migration history or roll forward blindly.

For all migration executions, record only the project/environment label,
tested commit, migration filenames, timestamp, and outcome. Do not put
credentials, connection strings, account data, or staging rows in GitHub
issues, logs, or source.

## Official references

- [Vercel branch-specific Preview variables and deployments](https://vercel.com/docs/git)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Supabase Auth redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase CLI migration history and dry-run commands](https://supabase.com/docs/reference/cli/v0/supabase-orgs)

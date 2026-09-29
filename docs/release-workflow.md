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

The current six timestamp-ordered migration files in supabase/migrations/
install the core schema and RLS policies, harden authorization, add
challenge-invite RPCs/triggers, and add privacy-safe group summary RPCs.
Review found no DROP TABLE, DROP COLUMN, or bulk table backfill in these
files. Several migrations define SECURITY DEFINER functions and change
grants/policies, so review those privileges and run the existing
supabase/tests/ authorization checks on staging; do not treat these as
routine unreviewed SQL.

The current reviewed set is:

- `20260917000000_create_core_schema.sql`
- `20260917000001_add_rls_policies.sql`
- `20260922000000_harden_rls_authorization.sql`
- `20260922000001_add_secure_challenge_invites.sql`
- `20260924000000_add_privacy_safe_group_progress.sql`
- `20260925000000_add_provisional_group_leader_summary.sql`

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

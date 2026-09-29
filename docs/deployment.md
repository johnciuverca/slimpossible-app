# Deployment handoff

## Current status

Vercel production is owner-managed and connected to `main`. After an approved
pull request merges into `main`, Vercel creates the production release. This
repository configuration does not create, access, or change Vercel accounts,
projects, tokens, or deployment settings.

## Vite build output

Vercel detects this React/Vite project and can use its existing production
build command:

```bash
npm run build
```

The build writes the static site to `dist/`, including `dist/index.html`. No
serverless function is required. The connected app uses Supabase Auth and
repositories when the owner supplies `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` to the intended local, Preview, or Production scope.
These are public browser configuration values; service-role keys, database
passwords, and other privileged values must never be added to Vercel client
environment variables. This repository does not reveal or independently
verify the current Vercel environment values.

Database migrations are a separate owner-managed change. A frontend deploy
does not apply them. Review the current migration order in
[`supabase-staging-setup.md`](supabase-staging-setup.md), verify the target
project before applying anything, and test the full migration chain in a
dedicated non-production project first. Never use production personal data for
acceptance tests.

For the persistent feature → staging → release PR → main workflow, branch
scoped Preview configuration, migration promotion gates, and post-release
branch alignment, follow the
[staging release workflow](release-workflow.md). It does not configure Vercel
or Supabase or run migrations.

## Client-side routes

`vercel.json` rewrites non-file requests to `index.html`. React Router then
selects the matching client route, so direct requests such as
`/milestones-preview`, `/weigh-ins`, and `/challenge/setup` do not return a
hosting-provider 404. Static assets remain served by Vercel.

## Owner deployment handoff

The owner keeps Vercel's production branch connected to `main` and confirms the
existing build command and `dist` output directory. This GitHub Flow transition
does not change any Vercel setting or create a preview or production deployment.
`development` remains a historical branch and is not a release branch.

For the Chapter 14 release gate, follow the
[`14.7 connected release checklist`](14-7-connected-release-checklist.md).
It separates local/mock evidence from owner-run staging acceptance and records
the production configuration, migration, smoke, stop, and rollback gates. No
preview or production deployment is started by that checklist. Never commit
secrets or privileged values to this repository.

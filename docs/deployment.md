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
backend, serverless function, environment variable, or secret is required for
the current local-only app. When a later remote-auth issue is ready, the owner
must add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to that Vercel
project's environment settings for the intended preview and production scopes.
Those values are public browser configuration; service-role keys, database
passwords, and other privileged values must never be added to Vercel client
environment variables.

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

If a later remote service needs configuration, keep secrets in Vercel's project
environment settings or ignored local files. Never commit secrets or privileged
values to this repository.

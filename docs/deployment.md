# Deployment handoff

## Current status

The repository is prepared for Vercel static hosting, but no Vercel account,
project, preview, or production deployment has been created. Issue #102 is the
owner-managed deployment handoff.

## Vite build output

Vercel detects this React/Vite project and can use its existing production
build command:

```bash
npm run build
```

The build writes the static site to `dist/`, including `dist/index.html`. No
backend, serverless function, environment variable, or secret is required for
the current local-only app.

## Client-side routes

`vercel.json` rewrites non-file requests to `index.html`. React Router then
selects the matching client route, so direct requests such as
`/milestones-preview`, `/weigh-ins`, and `/challenge/setup` do not return a
hosting-provider 404. Static assets remain served by Vercel.

## Owner deployment handoff

For issue #102, the project owner should create and manage their own Vercel
account, import this repository, and confirm the build command and `dist`
output directory in Vercel. No Vercel token, account, preview URL, or
deployment has been created by this repository change.

If a later remote service needs configuration, keep secrets in Vercel's project
environment settings or ignored local files. Never commit secrets or privileged
values to this repository.

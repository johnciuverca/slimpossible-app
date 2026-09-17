# Slimpossible

Slimpossible is a React weight-loss challenge app based on the Slimpossible
tracker. It is currently a local-development MVP: it has no deployed public
environment, remote database, or remote authentication service.

## Prerequisites

- Node.js 24 LTS
- npm (included with Node.js)
- Git, for the issue and pull-request workflow

## Local development

Install the exact dependency versions recorded in `package-lock.json`:

```bash
npm ci
```

Start Vite's local development server:

```bash
npm run dev
```

Vite prints the local URL when it starts, normally `http://localhost:5173`.
Stop the server with `Ctrl+C`.

## Local routes

These routes are available from the local server:

| Route                            | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `/`                              | Home screen                                        |
| `/login`                         | Local sign-in screen                               |
| `/register`                      | Local registration screen                          |
| `/challenge/setup`               | Challenge setup form                               |
| `/challenge/participants/enroll` | Participant enrollment form                        |
| `/weigh-ins`                     | Local daily weigh-in form                          |
| `/milestones-preview`            | Public preview of the milestone-progress component |
| `/today`, `/progress`, `/goals`  | Locally protected placeholder/dashboard routes     |

`/milestones-preview` is useful for reviewing the milestone component without
needing a remote account or deployment.

## Quality checks

Run the same quality checks used by GitHub Actions:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run format` to apply Prettier formatting. Run the browser smoke suite
locally with `npm run test:e2e`; install Playwright's Chromium browser first
when needed:

```bash
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the formatting, lint, type-check, unit-test, production
build, and browser smoke commands for pull requests targeting `development` and
for pushes to `development`.

## Local-only authentication and data

The login and registration screens currently provide local client-side input
validation only. A valid submission reports that remote authentication or
registration is not configured; it does not sign a user in, create an account,
or persist a session. The protected routes only demonstrate client-side route
behavior; they are not production access control.

No environment variables are required to run the project today. Future remote
authentication uses the owner-provided public `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` values from `.env.local`; missing values keep remote
authentication safely unavailable. For the exact local and Vercel setup, see
[docs/authentication.md](docs/authentication.md).

## Environment-variable policy

Never commit secrets, credentials, access tokens, private keys, or populated
local environment files. The existing `*.local` Git ignore rule keeps files
such as `.env.local` out of version control; any future `.env.example` must use
placeholders only.

If remote authentication, hosting, or another external service is introduced,
the project owner must create and manage the required account. Use that owner's
service configuration locally or in the service's secret store; do not put
privileged values in browser-exposed `VITE_` variables.

## GitHub workflow and release handoff

Track work in the
[Slimpossible Development GitHub Project](https://github.com/users/johnciuverca/projects/8):

1. Start from the latest `development` branch and create one focused branch for
   the issue.
2. Keep each pull request narrowly scoped and target `development`.
3. Run the quality checks above, open the pull request, and let GitHub Actions
   complete successfully.
4. Request review; do not merge or close the pull request or linked issue until
   the reviewer or project owner directs it.
5. After the merge, the owner can close any still-open linked issue and update
   the Project status.

The app is not deployed yet. `vercel.json` prepares the Vite SPA for static
hosting and direct client-side routes, but it does not create an account or a
deployment. A public Vercel preview is a future handoff for issue #102 and
requires the project owner to create and configure their own Vercel account.
See [docs/deployment.md](docs/deployment.md) for the build output, route
fallback, and owner handoff.

## Code style

ESLint checks TypeScript and React code. Prettier uses no semicolons, single
quotes, trailing commas, two-space indentation, and an 80-character print
width. Tailwind CSS v4 is loaded through the Vite plugin and imported from
`src/index.css`.

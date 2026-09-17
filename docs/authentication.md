# Authentication boundary

## Current local behavior

The login and registration UI currently provide local client-side input
validation only. No authentication SDK or remote request is connected yet. When
the required public configuration is absent, a valid submission safely explains
which variables must be set. Even when the values are present, this issue does
not create an account or a signed-in session.

This means the app currently has no successful sign-in or registration,
persistent session, remote password storage, email verification, session
restoration, user profile, or production-grade access control. Client-side
protected routes are only a local UI boundary and must not be treated as
security.

## Environment contract

The app can still run locally without Supabase values. Remote authentication is
unavailable until both public variables are set:

| Variable                 | Owner source                                | Browser-safe purpose                 |
| ------------------------ | ------------------------------------------- | ------------------------------------ |
| `VITE_SUPABASE_URL`      | Supabase project dashboard, Project URL     | Identifies the owner-created project |
| `VITE_SUPABASE_ANON_KEY` | Supabase project dashboard, public anon key | Identifies the public browser client |

Copy `.env.example` to `.env.local` and have the owner add their project's URL
and public anon key there. `.env.local` remains ignored by the existing
`*.local` rule; `.env.example` contains placeholders only. Do not request or
commit a password, service-role key, database credential, token, or populated
environment file.

Vite includes `VITE_` variables in the browser bundle. Only the provider's
documented public anonymous key may be used here; a service-role key or any
other privileged value must never enter a `VITE_` variable.

When either public variable is missing, the authentication UI reports:

> Remote authentication is not configured. Set `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY`.

This is a configuration check only: it makes no network request, creates no
keep-alive traffic, and does not attempt authentication.

## Future remote authentication

Supabase Auth is the planned option for email/password authentication. Issue
#119 adds only a typed browser client and repository boundary; it does not add
authentication UX, session handling, or a Supabase Auth integration. The
owner—not Codex—handles accounts, billing, and credentials.

Any future remote-auth work must document its exact variables, keep secrets in
the service's secret store or ignored local files, and avoid committing real
values. A browser-safe publishable key may be exposed only when the provider's
documentation explicitly permits it; privileged keys must never enter the
client bundle.

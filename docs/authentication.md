# Authentication boundary

## Current local behavior

The login and registration UI currently provide local client-side input
validation only. No authentication SDK or remote project is connected. After a
valid submission, each screen explains that remote authentication or
registration is not configured; it does not call a remote provider, create an
account, or create a signed-in session.

This means the app currently has no successful sign-in or registration,
persistent session, remote password storage, email verification, session
restoration, user profile, or production-grade access control. Client-side
protected routes are only a local UI boundary and must not be treated as
security.

## Current environment policy

No environment variables are required today. Do not add real credentials to
this repository. `.env.local` remains ignored by the existing `*.local` rule,
and a future `.env.example` may contain placeholders only.

Never expose a password, token, private key, database credential, or a
privileged service key through a `VITE_` variable: Vite includes `VITE_`
variables in the browser bundle.

## Future remote authentication

Supabase Auth remains a possible future option for email/password
authentication, but it is not configured or required yet. If the project adopts
it, the repository owner must create and manage their own Supabase account and
project, then provide only the appropriate local configuration. The owner—not
Codex—handles accounts, billing, and credentials.

Any future remote-auth work must document its exact variables, keep secrets in
the service's secret store or ignored local files, and avoid committing real
values. A browser-safe publishable key may be exposed only when the provider's
documentation explicitly permits it; privileged keys must never enter the
client bundle.

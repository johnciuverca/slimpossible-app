# Authentication boundary

The agreed real-account UX and ownership contract is documented in
[authentication-ux-contract.md](authentication-ux-contract.md). This file
records the current implementation/configuration boundary; the contract is the
source of truth for Issues #123–#126.

## Current local behavior

The login and registration UI provide client-side input validation and connect
valid submissions to Supabase Auth when the required public configuration is
present. When configuration is absent, a valid submission safely explains
which variables must be set without making a request.

Provider failures are mapped to safe, actionable messages before they reach the
UI. The app does not display provider internals, tokens, or raw authentication
error payloads. Verification-pending is informational, while a returned
session produces an explicit signed-in success message.

This means the app still has no profile editing workflow or production-grade
access control beyond the authenticated route boundary. Client-side route
guards and RLS remain separate concerns; browser guards must not be treated as
the complete security boundary.

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

Supabase Auth provides the email/password integration. Issue #119 adds the
typed browser client and repository boundary, Issue #122 defines the real
account UX contract, Issue #123 connects sign-up and sign-in, and Issue #124
restores sessions, listens for auth changes, and protects account-owned routes.
Additional profile editing remains outside this issue. The owner—not Codex—handles accounts,
billing, and credentials.

## Profile boundary

When an authenticated session is restored or created, the app upserts one
`public.profiles` row with `id = auth.users.id` through the authenticated
repository boundary. The minimum stored field is `display_name`; the verified
Auth email remains the account email source and is not duplicated into the
profile table. Participant records use that same authenticated profile ID as
`participants.user_id`, so the existing RLS policies enforce identity
ownership. Profile initialization failures remain visible as a retryable auth
state; no local fake profile is presented as remote persistence.

Issue #144 keeps confirmation-required sign-up anonymous: a profile write is
attempted only after a session-bearing sign-up, sign-in, or restored session.
Existing profile display names are preserved, and delayed restore/profile work
is discarded after logout or an account change. Live confirmation still needs
the owner-managed test project and dedicated mailbox described in the staging
setup handoff.

Any future remote-auth work must document its exact variables, keep secrets in
the service's secret store or ignored local files, and avoid committing real
values. A browser-safe publishable key may be exposed only when the provider's
documentation explicitly permits it; privileged keys must never enter the
client bundle.

## Email verification and password recovery

Issue #147 adds public `/forgot-password` and `/reset-password` routes. A
recovery request always shows the same confirmation for a valid email address,
whether or not Supabase has an account for it. The reset form is available only
after Supabase supplies a recovery session; invalid or expired links direct the
person to request another link. A completed reset signs the browser out and
returns it to the public sign-in route.

The owner configures these flows in the Supabase project; do not add values to
source, chat, CI logs, or issue comments:

1. In **Authentication → URL Configuration**, set the production **Site URL**
   to the final app origin and add the exact redirect URLs used for testing and
   deployment:
   - `http://localhost:5173/login`
   - `http://localhost:5173/reset-password`
   - the exact Vercel preview or deployed origin followed by `/login`
   - the same exact origin followed by `/reset-password`
2. In **Authentication → Providers → Email**, enable the Email provider and
   choose the intended confirmation policy. Keep the confirmation and recovery
   templates on Supabase's managed delivery path unless the owner deliberately
   configures a mail provider outside this issue.
3. In Vercel, add only `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` to the owner-managed Preview and Production
   environments that should support remote auth. Redeploy after changing them.
   Never add a password, service-role key, database credential, or project
   token to a Vercel browser variable.

The app uses fixed same-origin destinations: verification links return to
`/login`, and recovery links return to `/reset-password`. The browser never
accepts an arbitrary redirect URL from form input or navigation state.

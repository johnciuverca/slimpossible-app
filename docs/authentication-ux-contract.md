# Real authentication UX contract

Issue #122 defines the account boundary for the later Supabase Auth work. It
does not connect the SDK to the UI or create an account.

## Account ownership

- Supabase Auth owns the email/password credential, verification state, and
  session. Slimpossible never stores or logs a password, access token, refresh
  token, or service credential.
- The authenticated Supabase user ID is the account owner key. A future
  `public.profiles` row uses the same ID as `auth.users.id`; it is not a second
  account system.
- The minimum application profile field is `display_name`. Email comes from
  the verified Auth user and is not collected as a second profile field.
- Sign-up therefore collects: email, password, password confirmation, and
  display name. Password confirmation is client-side validation only and is
  never sent as a separate stored field.
- Weight, challenge, and participant data are collected after account setup,
  not during sign-up.

## UX state contract

The implementation must represent these states explicitly:

| State                   | User-visible behavior                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `configuration-missing` | Explain that the owner must provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; make no authentication request.                            |
| `loading`               | Show a neutral loading state while the existing session is resolved; do not flash signed-out content or protected data.                          |
| `signed-out`            | Show public login, registration, and recovery actions. Protected routes redirect to `/login` with a safe return location.                        |
| `verification-pending`  | Confirm that a verification email was requested, avoid saying the account is fully active, and offer sign-in/recovery guidance.                  |
| `signed-in`             | Show the account identity and allow authorized app routes; data access remains governed by RLS and repositories.                                 |
| `recovery-requested`    | Confirm the recovery request without revealing whether an email is registered.                                                                   |
| `recovery-ready`        | Allow a new password only from a valid recovery session, then return to sign-in.                                                                 |
| `auth-error`            | Show a short actionable message without provider internals, credentials, tokens, or passwords. Preserve entered non-sensitive fields where safe. |
| `network-error`         | Explain that the service could not be reached and offer retry; do not claim sign-in, sign-up, or recovery succeeded.                             |

## Route expectations

Public routes are `/login`, `/register`, `/forgot-password`, and
`/reset-password`. Signed-out users may view public informational and preview
routes, but must not access account-owned challenge, participant, weigh-in, or
dashboard data.

The future session-protection issue (#124) will enforce redirects for protected
routes. The future integration issue (#123) will connect the forms to Supabase
Auth. This issue only agrees on the states and boundary; it does not add those
routes, network calls, session listeners, or redirects.

## Configuration and safety boundary

The browser may receive only the provider-approved public project URL and
anonymous/publishable key through `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. The owner supplies those values in their own ignored
`.env.local` and later in the appropriate Vercel environment settings if live
authentication is enabled. Codex must not request, log, commit, or test with
the owner's values.

Missing or malformed public configuration is a visible unavailable state, not
a reason to invent credentials or fall back to a fake signed-in account. Local
form validation may remain available for the MVP, but it must never claim that
an account, session, verification, or password recovery was created remotely.

## Explicit exclusions

Issue #122 does not implement Supabase sign-up/sign-in/recovery calls (#123),
session protection (#124), profile persistence (#125), or end-to-end cloud
verification (#126). It also does not change RLS, repositories, challenge
flows, weigh-ins, activity checks, or unrelated UI.

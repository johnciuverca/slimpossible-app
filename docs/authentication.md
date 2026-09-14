# Authentication boundary

Issue #31 defines the contract for the authentication work that follows. It
does not add the authentication SDK or connect the app to a remote project.

## Provider decision

The app will use Supabase Auth for email/password authentication. Supabase is
the smallest fit for the current React/Vite app because it supplies hosted
authentication and session handling without requiring us to build password
storage or a session backend. The later authentication issues own the SDK
integration and the login, registration, logout, profile, and protected-route
behavior.

Social login is out of scope unless a later issue shows that the chosen
implementation needs it.

## Environment contract

The browser client will read these Vite variables:

| Variable                 | Required for remote auth | Meaning                                                                  |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Yes                      | The Supabase project URL, for example `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes                      | The Supabase publishable/anonymous browser key                           |

Use `.env.local` for local values. `.env.local` is ignored by Git through the
existing `*.local` rule. `.env.example` contains placeholders only and is safe
to commit.

Only the public browser key belongs in these `VITE_` variables. Never place a
Supabase service-role key, database password, or other privileged secret in a
`VITE_` variable or in the repository. Vite exposes `VITE_` variables to the
browser bundle.

## Local development fallback

Until valid Supabase variables are available, the app remains runnable in a
local, unauthenticated preview mode:

- build, lint, tests, and the public shell continue to work;
- remote sign-in and registration are not attempted;
- later auth UI should explain that remote authentication is not configured;
- protected features must not pretend that a local placeholder user is a real
  authenticated Supabase user.

This fallback is intentionally non-persistent. It must not store passwords,
tokens, or fake sessions in source code, browser storage, or test fixtures.

## Account and service requirement

Remote authentication requires the repository owner to create a Supabase
account and project personally. The project is needed to provide the URL and
anonymous browser key above and to enable email/password auth. Codex does not
create the account, subscribe to a plan, or handle the owner’s credentials.

The next integration issue can begin after the owner supplies local
`.env.local` values. No real values are committed to this repository.

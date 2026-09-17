# Supabase activity check

Issue #127 adds
`.github/workflows/supabase-activity.yml`, a low-frequency, read-only request
intended to support the owner-created Supabase Free-plan inactivity boundary.
It is operational housekeeping, not application functionality.

## Request behavior

- Runs weekly at 03:17 UTC on Monday and can also be started manually with
  **Run workflow**.
- Calls only the documented Supabase Auth health endpoint:
  `GET /auth/v1/health`.
- Sends the public anonymous key as the `apikey` header and discards the
  response body. It logs only success or an HTTP/request failure.
- Does not read application tables, create users or weigh-ins, write data, or
  expose response data.
- Uses read-only GitHub Actions contents permission.

Supabase documents this health endpoint and public-key header in its
[GoTrue/API health-check guidance](https://supabase.com/docs/guides/troubleshooting/how-do-i-check-gotrueapi-version-of-a-supabase-project-lQAnOR).

## Owner setup

The repository owner must add these GitHub repository Actions secrets; Codex
does not need or receive their values:

| Secret              | Value and purpose                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`      | The owner-created project's public URL, used to build the Auth health endpoint.                  |
| `SUPABASE_ANON_KEY` | The project's public anonymous/publishable key, used only as the health-request `apikey` header. |

Add them under the repository's **Settings → Secrets and variables → Actions**
before running the workflow manually. If the secrets are missing, the workflow
fails visibly with a configuration error and makes no request.

## Removal

To remove the check, delete
`.github/workflows/supabase-activity.yml` and optionally remove the two Actions
secrets. No Supabase dashboard, database, user, table, or application setting
needs to be changed.

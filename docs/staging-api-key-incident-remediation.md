# Staging API key incident remediation

This is a local review plan for the Staging credential incident. It is not
authorization to create keys, change hosted settings, revoke credentials,
deploy, or touch Production. Keep `verify_jwt = true` in
`supabase/config.toml`.

## Prepared code change

- `delete-account` reads the named `default` entry from Supabase's injected
  `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` JSON maps. Missing,
  malformed, or empty entries fail closed. There is no legacy service-role or
  anon-key fallback and key values are never logged.
- The caller-scoped client puts the publishable key in the SDK's `apikey`
  header and forwards the caller's user JWT in `Authorization`. The handler
  continues to call Auth `getUser()` and derives the deletion identity only
  from that verified user. The separate admin client uses the secret key for
  the existing privileged operations.
- Browser configuration keeps the established `VITE_SUPABASE_ANON_KEY`
  environment variable name for compatibility with Production configuration.
  It accepts a public anon or publishable key; no browser secret is used.

## Staging-only operator sequence

1. In Staging Supabase **Settings → API Keys**, the `default` publishable key
   and `default` secret key are already listed (read-only dashboard check on
   2026-11-17). Use those named entries; do not create duplicates unless the
   owner deliberately chooses separate named keys. Supabase documents both
   named-key maps as injected into Edge Functions. Do not copy key values into
   chat, source, logs, or files.
2. In Vercel **Project → Settings → Environment Variables**, update only two
   branch-specific Preview scopes:
   - Edit the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` entries
     whose **Preview** Git Branch is `staging` (confirmed in a read-only
     dashboard check on 2026-11-17). Keep the URL on the Staging project and
     set the key to its existing default publishable key.
   - Add branch-specific Preview overrides for `VITE_SUPABASE_URL` and
     `VITE_SUPABASE_ANON_KEY` on `codex/404-weekly-finalization`, using the same
     Staging URL and existing default publishable key. This feature preview
     must not inherit the unchanged shared Preview value when legacy keys are
     retired.

   Leave shared Preview values, other branch scopes, Production, and
   Development unchanged. Redeploy both the `staging` and
   `codex/404-weekly-finalization` previews after the code is pushed.

3. Deploy the reviewed function code to Staging, with `verify_jwt = true`.
   Confirm the app sends `Authorization: Bearer <user access JWT>` and the
   publishable key separately as `apikey`. Confirm handler Auth `getUser()`
   returns the same caller identity used for the deletion operation.
4. With a separately approved disposable-account test, verify signed-out and
   mismatched-user requests are denied and the intended disposable account's
   own deletion path behaves as expected. Do not use an existing user.
5. Inventory all Staging consumers and CI/integration configuration without
   listing or printing key values. After the owner accepts the cutover, use
   Staging Supabase **Settings → API Keys → Legacy API Keys** to deactivate
   both legacy keys, then **Settings → JWT Keys → Legacy JWT Secret** and
   follow Supabase's documented signing-key rotation/revocation flow to retire
   the old HS256 secret. The read-only dashboard currently shows the previous
   HS256 key is still used to verify tokens that have not expired; the owner
   has accepted the possible Staging sign-outs. Do not act on Production.
6. Recheck the Staging function and preview after rotation. Revoking the
   legacy JWT signing secret can invalidate active Staging Auth sessions;
   users, including the disposable test identity, may need to sign in again.
   Production configuration and sessions are outside this runbook.

## Header and gateway decision

Supabase's current authorization-header reference distinguishes a user JWT in
`Authorization` from a publishable key in `apikey`, says the gateway verifies
user JWTs when `verify_jwt` is enabled, and directs user-facing functions to
keep that setting enabled. The migration guide's `verify_jwt = false` advice
addresses calls where a new API key is sent as `Authorization: Bearer ...` or
where the `@supabase/server` SDK performs its own authorization. This function
uses a user JWT in `Authorization`, so that advice does not apply. Keep the
JWT check and the handler's independent `getUser()` validation.

## Local verification and incident prevention

- `keyConfig_test.ts` uses placeholders to check named-key selection and
  fail-closed parsing. It never reads a real environment file or prints key
  values.
- Do not run CLI commands that enumerate or reveal API key values. If a
  metadata inventory is needed, request only key identifiers, names, and
  types, excluding all key/token fields. Never display raw JSON responses.
- No hosted key creation, environment changes, revocation, deployment, account
  deletion, initializer, or Production operation is part of this local patch.

# Release verification

This project has two verification lanes. CI and local checks never need a
Supabase account. The live lane is owner-run against a dedicated non-production
Supabase project and must never use personal production data.

## CI and local verification

Run the complete suite from the repository root:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

The injected auth gateway tests cover session restoration, auth-state changes,
remote sign-out, profile initialization, safe error states, and protected-route
return locations. Repository tests cover profile upsert and challenge,
participant, and weigh-in mapping. Browser smoke tests cover signed-out route
protection, public routes, form validation, and missing-configuration behavior.
These checks intentionally do not claim that a real account or remote row was
created.

## Owner-run live verification

Use a dedicated Supabase project and test mailbox. The owner should:

1. Enable Email provider authentication in the project Authentication settings.
2. Apply the checked-in migrations in `supabase/migrations/`.
3. Add only the browser-safe project URL and anonymous key to the owner-managed
   ignored `.env.local`:

   ```text
   VITE_SUPABASE_URL=https://<dedicated-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<dedicated-project-anon-key>
   ```

4. Start the app with `npm run dev` and use a dedicated test email to verify:
   - sign-up creates the account and shows verification-pending when email
     confirmation is required;
   - verified sign-in restores the session after a page refresh;
   - sign-out ends the session and protected routes redirect to `/login` with
     the original path, query, and hash preserved;
   - a `public.profiles` row exists with `id = auth.users.id` and the expected
     `display_name`; email is read from Auth and is not duplicated in profiles;
   - a challenge, participant linked to the authenticated profile ID, and
     weigh-in remain present after sign-out and a new sign-in;
   - a second authenticated user cannot read or edit the first user's profile,
     participant, challenge, or weigh-in rows; anonymous requests cannot access
     account-owned rows.

5. Remove or rotate the dedicated test account and project data after the
   verification run if the project is not retained for staging.

Never put a password, service-role key, database credential, project token, or
populated environment file in the repository, CI logs, screenshots, or issue
comments. The anonymous browser key is the only provider value permitted in
the local browser configuration.

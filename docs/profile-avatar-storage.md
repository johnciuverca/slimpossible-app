# Profile avatar storage

Uploaded profile photos use the private `profile-avatars` Supabase Storage bucket. Objects are stored under `<auth-user-id>/<random-uuid>.<jpg|png|webp>`. The bucket accepts JPEG, PNG, and WebP files up to 2 MiB. The client checks the file signature and decoded dimensions before upload; Storage policies independently restrict reads, inserts, and deletes to the signed-in user's own folder.

The profile row stores either an owner-scoped uploaded object path or a built-in preset ID, never both. The app creates a five-minute signed URL for the owner's current photo. Signed URLs are bearer links; do not persist or share them. Replacing/removing a photo updates the profile pointer before deleting the old object, so failed cleanup can leave only a private orphan.

Built-in avatar selections are stored as `male-01` through `male-15` or `female-01` through `female-15`. Both sets are available to every account. The approved artwork is served from two 5-by-3 contact sheets in `public/avatars/`; CSS positions each choice inside its tile and clips the white gutters. The selected preset remains private in the owner-only profile row.

The migration in this change is for review and staging deployment planning. A read-only check of the active staging project's `public.profiles` columns found neither `avatar_path` nor `avatar_preset_id`; the deployed preview therefore cannot load or save avatar selections until that migration is applied. The app reports this missing-schema state explicitly. Do not apply the migration to hosted Supabase or production without the user's direct approval and an environment-specific deployment plan. No hosted schema changes have been made.

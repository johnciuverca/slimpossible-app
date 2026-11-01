# 19.2 — Account Username editing

The Profile dialog edits `public.profiles.display_name`, the same canonical
source initialized by registration. Username accepts a name or nickname with
1–80 characters after trimming. The Auth UUID remains the ownership key;
email/password sign-in is unchanged. Auth signup metadata is only an initial
seed and is not written by profile editing.

Username is plain text like Email until the accessible pencil button is selected;
there is no textbox in viewing mode. Edit mode
focuses the field and offers Save and Cancel; successful save returns to plain text,
and Cancel restores the saved value without a write.

Saving verifies the active Supabase user before upserting the explicit profile
UUID and display name. Existing `profiles_insert_own`, `profiles_update_own`,
and `profiles_select_own` RLS policies restrict these operations to `auth.uid()`.
Upsert also permits an older authenticated account without a profile row to
set its first name. No schema or policy changes are needed.

On success the Auth context and its profile cache update immediately. Reload
reads the saved profile rather than old signup metadata. A failed save retains
the previous name and editable draft. Account generations discard late results
after switching accounts, including switching away and back. A pending profile
initialization read cannot replace a newer saved name. Concurrent saves for the
same account are rejected until the outstanding write finishes.

## Participant name audit

`participants.display_name` is a separate, required per-challenge membership
name in `20260917000000_create_core_schema.sql`. Enrollment and invite acceptance
store the name supplied for that membership. Existing participant editing may
change it independently. It is not an immutable name recorded per weigh-in.

Group projections such as `get_group_chart_history` and the member progress
projection prefer the participant name (`coalesce(participant.display_name,
profile.display_name, 'Member')`). Editing the account Username does not update
those membership records, weigh-ins, notes, or share rows. Existing group labels
therefore continue using their membership names. Where a projection has no
participant row (for example a sharing owner without membership), its existing
profile-name fallback uses the current account name, including when displaying
older shared values. This existing fallback is not a frozen historical label.

This change preserves those projection semantics. Propagating account name
changes into participant rows or introducing immutable historical labels would
require a separately reviewed change; neither is performed here.

## Verification

Focused tests cover successful save/reload, validation, failure/retry, account
switching, stale initialization reads, UUID verification, and the profile-only
write payload. Browser coverage exercises the Profile dialog with a synthetic
gateway. Connected account/mailbox acceptance remains an owner check on the
current Preview; fixture evidence does not establish connected Supabase writes.

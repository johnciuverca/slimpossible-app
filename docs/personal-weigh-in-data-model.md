# Issue #210: personal weigh-in data model and migration decision

## Canonical model

A weigh-in is owned by `auth.uid()` and keyed by `(user_id, recorded_date)`, not by a challenge participant. Store the date, positive kilogram value, and a private note on that personal entry. Enforce one entry per user/date in the database; editing the same date updates that row, while changing the date must fail if another row already owns the destination date. A user can save with no challenge membership or challenge selection.

Represent group visibility separately as explicit `(personal_weigh_in_id, challenge_id)` share rows. One personal entry may have zero or more shares. Insert/update/delete share rows in the same database transaction as the personal-entry write; an RPC is the preferred write boundary so a partial share failure cannot be reported as a successful save. The server must verify the caller owns the entry and is the challenge owner or an active participant for every selected non-personal challenge. Reads return only the entry date, weight, and the minimum authorized display name; never return the note. RLS and RPC checks must deny other users, inactive/withdrawn members, outsiders, and cross-challenge lookups. Deleting a personal entry cascades its share rows; the UI requires confirmation and summaries are recomputed from the remaining rows.

Personal challenge scoring continues to consume the user's canonical history without requiring an explicit group share. Group scoring must retain the current challenge-date, baseline/goal, and Sunday rules; it may consume only rows associated with that challenge and must not infer consent from membership. Remembered group choices are UI suggestions only, visibly editable and never submitted implicitly.

Canonical table privileges are reset explicitly for `PUBLIC`, `anon`, and `authenticated`, regardless of the migration executor's inherited defaults. Only authenticated SELECT is regranted on personal entries, with an authenticated author-only RLS policy; writes, shares, and provenance stay behind authorized RPCs. The UUID keys create no sequences. No global default ACL is changed. RLS row denial alone is not a substitute for least-privilege ACLs: privileges such as TRUNCATE are not row-filtered. The local-only `supabase/tests/personal_weigh_in_default_privileges.sql` fixture verifies permissive defaults are neutralized and left unchanged by the migration; run it only on an explicitly authorized disposable pre-#210 database.

## Legacy compatibility and migration policy

### Draft-group compatibility correction (2026-10-08)

Owner-approved eligibility is a non-personal group with challenge status `draft`
or `active`, where the caller is the owner or an active member. Setup creates
draft groups and has no activation workflow; draft is not an inactive membership.
Completed/archived groups, personal challenges, outsiders, and withdrawn-only
memberships cannot receive new/updated sharing. Legacy NULL challenge kinds stay
group contexts. UI choices and local saves use the same predicate; the SQL RPC
independently enforces it. Legitimate prior draft shares stay selected on edit.
If eligibility lookup fails, editing a shared entry is blocked until reload;
genuinely unavailable shares show a persistent warning and require confirmation
before a correction removes them.

The original #210 migration was applied to staging by PM on Oct 8. Do not rewrite
or rerun it there. Review the distinct forward correction
`supabase/migrations/20261008000000_allow_draft_group_weigh_in_sharing.sql`:
it replaces only the save RPC and changes only its lifecycle predicate. It
preserves the existing restricted ACL and all stored data, shares and statuses.
Applying this SQL to hosted staging requires separate approval; implementation
approval does not authorize SQL execution, production changes, or merge. A new
preview alone does not correct the already-deployed server function.

Run `bash supabase/tests/run_local_personal_weigh_in_eligibility.sh` for synthetic
socket-only PostgreSQL clean-install, already-applied upgrade, and permissive-default
coverage. All three paths run the 32 existing authorization assertions plus the draft/active
eligibility contract. Upgrade checks preserve canonical/legacy/share rows and
RPC ACL/ownership and reproduce then correct the old draft rejection. These
local checks are not connected acceptance. The existing permissive-default
fixture also applies the correction to verify grants remain minimal.

The legacy `public.weigh_ins` table is keyed by `(participant_id, recorded_date)`, with a note and the per-row `share_with_group` flag delivered in PR #230. A user can have multiple participant rows across challenges, so more than one legacy row can map to the same `(user_id, recorded_date)`. The old unique constraint does not prevent that. PR #230 completed owner-confirmed connected acceptance and was merged into staging; its migration is inherited from the base, not duplicated in this PR.

Use an additive, reversible migration. Keep `weigh_ins` and all source rows/notes intact during rollout; do not drop, overwrite, or repoint legacy rows. A migration preflight must inventory duplicates by user/date and classify weight and note conflicts before any data transformation. A date with multiple legacy rows is not silently collapsed, even if the weights happen to match: separate notes, timestamps, and prior per-challenge opt-ins are meaningful source evidence. If any duplicate date exists, stop the data-copy phase and obtain an owner/PM resolution for each affected date. Preserve all original rows while resolving; never pick a weight/note by row order or automatically broaden a legacy opt-in to other challenges.

For unambiguous single-row dates, copy the exact date, weight, note, and timestamps into the canonical entry and translate only an existing explicit `share_with_group = true` into a share for that source row's non-personal challenge. A false/missing opt-in stays private. Any legacy opt-in attached to a personal challenge remains visible in the provenance map but does not become a group share. Keep an auditable mapping from each legacy row to the canonical row/share so rollback and reconciliation are deterministic. Do not delete legacy data in this issue. Before applying the migration to any hosted database, present the read-only duplicate inventory and reversible migration plan for separate owner approval; no hosted SQL is authorized here.

## Compatibility sequence

1. Add canonical tables, RLS, and transaction-safe repository/RPC contracts without removing the legacy schema.
2. Run the read-only duplicate/conflict inventory and stop if any duplicate `(user_id, recorded_date)` needs a decision.
3. After owner resolution, copy only unambiguous rows and exact prior opt-ins in one transaction, retaining source rows and a reconciliation map.
4. Switch reads/writes to canonical entries while keeping explicit compatibility reads for the old challenge-specific scoring until those consumers are migrated and tested.
5. Retire legacy writes or tables only in a separately reviewed migration after all consumers and hosted acceptance are proven.

## Application rollback

Use `supabase/rollback/20261007000000_restore_pre_210_rpcs.sql` only after
rolling the application client back and taking a verified backup. It restores
the four pre-#210 RPC bodies that this migration replaces. It intentionally
does not drop canonical tables, personal RPCs, shares, provenance, or rows.
That is the data-preserving inverse: users can roll the app forward again
without losing any post-rollout personal entries.

Canonical-only entries created after rollout remain in `personal_weigh_ins`.
The older app does not display or update them. Legacy reads can also show
outdated versions of migrated entries that were edited or deleted canonically
after rollout, because the retained legacy rows are not rewritten by canonical
operations. Keep the legacy client read-only during recovery until those rows
are reconciled with canonical changes and deletions. Do not automatically copy them
into `weigh_ins`: private entries have no challenge/participant destination,
and choosing one would silently broaden visibility. If users must keep logging
while recovery is in progress, keep the personal-entry client/RPC path enabled;
do not reopen legacy writes before reconciliation. Reconcile this retained data during the
next forward rollout before retiring the canonical tables.

## Delivery dependency

PR #230 completed owner-confirmed connected acceptance and merged into `staging` at `4a880cab3e5cd7c26ee3e4e9b31091186b9cd98a` on 2026-10-07. Issue #209 is closed. This implementation is rebased onto that staging head and PR #232 targets `staging`, containing only #210 changes. The dependency gate is satisfied, but #210 still requires PM review, a separately approved hosted migration preflight/application, and owner-confirmed connected acceptance before any authorized merge. A successful local migration or Vercel build does not establish hosted acceptance.

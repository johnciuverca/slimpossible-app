# 16.6 — Personal Dashboard and My Progress

Issue #231, based on staging after #232. Owner/PM naming decision: Dashboard,
not Today. No schema, hosted SQL, auth, environment or production changes.

## Behavior

- Signed-in `/` without a challenge query and `/dashboard` show personal history.
  `/today` remains a compatible Dashboard alias, including old challenge queries.
- Latest personal weight and logged-today state use canonical personal records.
  The last 30 days show real saved dates only; no estimated values or invented
  target. Personal loading/error/empty states are separate from challenge loading.
- Record weight opens a native desktop dialog or mobile bottom sheet. New entries
  have no groups checked. Edits preserve prior explicit choices while eligibility
  loads; removing unavailable shares needs confirmation. A new-entry date collision
  directs the author to edit the existing record rather than silently unsharing it.
- Escape/cancel closes the dialog before unmount and restores trigger focus.
  Account-switch cleanup does not deliberately restore the previous account's focus.
- `/progress` shows full personal history, graph, author-private notes, edit/delete.
  `/progress?challenge=...` is clearly labelled as a separate challenge view.
- Challenge cards have independent links and summaries. Group percentages come
  from the existing authorized aggregate RPC, not local guesses. Missing authorized
  aggregates are shown as unavailable. Personal challenge completion uses existing
  participant goal rules. Saving/deleting refreshes personal and challenge data.
- Personal navigation drops selected-challenge queries. `/challenges` preserves the
  earlier overview; `/weigh-ins` remains the canonical full-page fallback.
- Keyed snapshots hide previous-account history immediately and discard stale loads.
  Open editors and notices reset on account changes; late saves/deletes cannot update
  another account's view.

## Local validation — 2026-10-08

- Format, lint, typecheck, build and `git diff --check`: passed.
- Unit tests: 413 passed in 68 files, including personal loading/error isolation,
  canonical saves, explicit shares, deletion, account switches and aggregate reload.
- Browser tests: 49 passed (47 application + 2 group). Six new Dashboard tests
  exercise desktop/mobile no-context logging, Escape/focus/keyboard behavior,
  reload persistence, canonical edit/delete, separate challenge views, explicit
  draft/active sharing, account isolation and narrow-layout overflow.
- In-app browser smoke: local synthetic no-context Dashboard inspected visually;
  latest-weight, logged-today and trend empty states render independently of groups.
- Browser fixtures are synthetic/local only, with hosted Supabase disabled. Legacy
  Today fixture coverage is not counted as coverage of the new Dashboard.
- Build reports the existing large-bundle warning; bundle splitting is outside scope.

## Connected staging acceptance — NOT EXECUTED for #231

Local/browser success does not establish hosted acceptance. PM/owner should test
the new PR's immutable preview using authorized staging identities:

1. Open Dashboard directly and via `/today`; confirm personal latest weight and
   logged-today status, with challenge selection unnecessary.
2. Record a disposable unused date privately; inspect the real trend and reload.
3. Explicitly share to an eligible group, edit without losing choices, and verify
   the authorized recipient sees weight but never the author's note.
4. Edit/delete the disposable record from My Progress; verify personal and relevant
   challenge summaries refresh. Do not delete older acceptance records.
5. Switch existing accounts; confirm no previous-account notes/editor/history.
6. Confirm mobile sheet, keyboard focus/Escape, and distinct challenge links.

No new accounts, membership deletions, migration or production change is required.
Leave the PR unmerged for PM review and owner confirmation. Weight-card/icon and
edit-scroll design follow-ups are intentionally excluded.

# 16.7 — Personal weight-record cards and focused editing

Issue #234; based on staging `b74dc3b` after #233.

## Scope

My Progress and the full `/weigh-ins` fallback share one personal record-card
component: prominent weight, smaller semantic date, optional author-private note,
subtle Private/Shared with label, pencil/trash SVG buttons. Buttons have record-date
accessible names, date/weight title tooltips, visible keyboard focus and 44px targets.
No empty note placeholder is rendered.

My Progress retains its existing weight-focused modal. Full-page Edit scrolls the
editor into view and focuses weight only in response to the edit action, never as a
side effect of loading history. Existing canonical dates, explicit sharing and
author/account isolation stay unchanged. Existing chart/summary refresh paths remain.

Both delete confirmations identify weight and date and explain linked-share removal.
Pending deletion disables card actions and is announced. The fallback retains the
card and reports an error if deletion returns false/empty/error or throws; a missing
success is not treated as deletion. Confirmed removal retains existing share cleanup.

No schema, hosted SQL, ranking, auth/environment or production changes.

## Local evidence — 2026-10-08

- Format, lint, typecheck, build and diff checks passed.
- 417 unit tests passed across 69 files. New coverage checks card content, labelled
  actions, optional notes, pending deletion and retention after unconfirmed deletion.
- 53 browser tests passed: 51 application + 2 group. Four new tests cover both pages
  at 1280px and 390px: keyboard Edit, modal focus/Escape, fallback scroll/focus,
  no focus theft on load, 44px buttons, title tooltips, date/weight confirmation,
  cancel, successful delete, empty history after reload and no page overflow.
- Existing canonical save/edit/sharing and account-isolation browser coverage passed.
- Local in-app browser visual smoke inspected the synthetic My Progress record card.
- The build still reports the large-bundle warning; bundle splitting is out of scope.

Initial browser failures were a test selector mismatch (`Cancel` vs `Cancel edit`),
corrected before the full passing run. Browser fixtures are synthetic/local with
hosted Supabase disabled, not connected staging acceptance.

## Connected staging acceptance — NOT EXECUTED for #234

PM/owner should use the immutable preview for this PR with authorized staging users:

1. Inspect cards in My Progress and full Weigh-in, including private/shared labels,
   optional notes and pencil/trash hover help.
2. Keyboard-activate Edit; check modal weight focus, or full-page scroll/weight focus.
3. Use a disposable entry to inspect date/weight deletion confirmation, cancel it,
   then confirm deletion and reload. Preserve older acceptance records.
4. Check narrow/mobile targets and existing account switching; other users' notes
   must never appear. Confirm existing explicit shares survive an edit.

Leave the focused PR unmerged for PM review and owner acceptance. No hosted writes,
new accounts, migrations or production changes were performed during implementation.

# 16.11 — Spreadsheet-style Group history and member tabs

Issue #244, parent #199. Base: freshly fetched staging
`ff6a8fbb170fb087470259c1638d29133f2d1f50` (merged #243).

## Scoped behavior

- All members shows the existing own-first-shared-entry kg comparison chart.
  History is now a matrix: real dates newest first on the left, member column
  headers, exact shared kg cells, and dashes for missing member/date entries.
- Each member tab filters the same selected-group authorized projection into
  one member's chart/history. Duplicate names retain distinct group-scoped keys
  and visible member ordinals. Tabs only exist for members returned in shared
  history; no private roster, missing weights or unshared members are invented.
- Arrow keys/Home/End select tabs with roving keyboard focus. Account/group
  changes reset selection and hide stale results; refresh preserves a still
  shared member, and removing their last share falls back to All members.
- A bounded sticky bar holds the existing common header/challenge navigation
  and member tabs. Its upper area scrolls vertically on short screens; tabs
  remain accessible below it. Resize-observed focus offsets keep content below
  the bar. The matrix scrolls in both axes with sticky date/member headers.
- No new RPC, SQL migration or permission change. Group history only consumes
  `get_group_chart_history`; no new personal-history/raw-identity/note/email/
  private-target/enrollment-baseline fetch. Existing recording and group ranking
  behavior remain unchanged.
- #242 is not incorporated: heading-before-challenge-tab order and existing
  challenge-selection behavior remain. Its future layout integration needs
  independent review because this issue wraps navigation for sticky behavior.
  #245 recorder work is untouched.

## Executed local verification — 2026-10-09

Format/lint/typecheck/build/diff checks passed. 446 unit tests across 74 files and
77 Playwright tests (69 application + 8 Group) passed. New coverage checks exact
matrix pivot/null gaps, duplicate-name columns, one-member filtering without
additional fetches, correction/share-removal selection behavior, account/group
reset, keyboard/mobile sticky containment, and private/raw-data exclusion.
The existing bundle-size warning remains.

An initial mobile overflow failure was fixed by containing absolutely positioned
screen-reader cell text inside its relative-positioned cell. The regression
now verifies no horizontal page overflow at 390px. Read-only in-app visual QA of
the labeled local-only synthetic fixture confirmed comparison/matrix layout,
sticky member tabs and individual-member view; viewport was reset and the local
server stopped. This is not connected staging acceptance.

## Owner/PM preview checks — PENDING

1. In an existing authorized staging group, check All members: date rows, exact
   kg under the corresponding member, and dashes instead of invented weights.
2. Select each shared member; only that member's group-shared chart/history
   should remain. Try keyboard arrows/Home/End and mobile horizontal scrolling;
   verify sticky navigation does not hide focused content. Duplicate names must
   remain distinguishable if the approved group has them.
3. Refresh after an approved disposable correction/share removal; switch group
   and account and confirm no stale selected-member data. Do not modify real
   personal data for acceptance without separate authorization.

Connected preview/owner visual confirmation and independent PM sign-off remain
pending. No merge, hosted mutation or production release is authorized here.

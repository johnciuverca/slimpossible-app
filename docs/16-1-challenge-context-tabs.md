# #229 — Challenge context pills

Based on staging `a56f98c` after #235. The latest PM clarification supersedes the
original issue's save-destination wording. #236's button wording is excluded.

## Navigation, not sharing

Authorized context pills appear on Dashboard, Challenges, My Progress, Goals,
Group and Weigh-ins. Personal/Group labels identify challenge kinds; Personal
tracking remains separate and always accessible. Pills are real navigation links
with `aria-current`, selected text, focus outlines, 44px minimum height and a
horizontal scroll row. No challenge dropdown is used; the selected pill is brought
into view horizontally without moving page focus.

- Dashboard and `/today` remain personal; challenge pills open explicitly labelled
  `/progress?challenge=...` views rather than silently filtering Dashboard history.
- My Progress, Challenges and Goals retain the page when switching challenges.
  Meaningful challenge-page header navigation retains the selected challenge query.
- Group switches group queries; personal challenge links leave Group for explicit
  challenge progress. Personal tracking returns to Dashboard. Personal contexts do
  not expose group-only summaries/actions.
- Weigh-ins query-only pills preserve the personal form, private history and every
  existing checkbox choice. The explanatory label makes this non-destination meaning
  explicit. Returning to Personal tracking removes the query without losing input.

Tab loading uses the existing owned/active-joined visibility contract. Keyed state
hides old-account contexts synchronously and ignores late responses. Group data is
also keyed by account/selection so prior summaries do not flash during switches.
Loading, missing selection, no-context and failure feedback remain distinguishable.

## Unsaved editor safety

The shared editor registers dirty/saving state with the live layout. In-app links
that would leave/discard its input show a native modal with **Stay** and **Discard
and leave**. Staying preserves the editor; discard never saves or carries values to
another view. Navigation during an in-flight save has Stay only. Query-only
Weigh-ins changes are allowed because they do not discard or change the form.
Pending navigation is cleared on account changes. Native editor modals already
prevent outside-page navigation while open.

There is no new save destination, automatic checkbox selection, unsharing,
backfill or canonical record rewrite. No schema, hosted SQL, auth/environment,
ranking or production changes.

## Local evidence — 2026-10-08

- Format/lint/typecheck/build/diff checks passed. Existing large-bundle warning remains.
- 426 unit tests passed in 70 files, including authorized contexts, route mappings,
  personal active state, account isolation, failures and existing Group summary switching.
- 61 browser tests passed: 57 application + 4 group. Six new desktop/mobile tests
  cover all six pages, keyboard navigation, many-context overflow/active visibility,
  direct query refresh, unchanged canonical records, untouched sharing checkboxes,
  unsaved Stay/Discard and account-context/history isolation. Two additional Group
  tests switch distinct synthetic saved summaries/winners and verify direct refresh.
- Local in-app browser visual smoke inspected personal Dashboard and its pill row.
- The mobile test detected an absolute screen-reader selected label escaping the
  scroll container; positioning it relative to its link fixed the page overflow.
- Initial Group refresh assertions reset the fixture's MemoryRouter. The fixture
  now supports an explicit selected query for direct-load/refresh verification.
- All fixtures are synthetic/local or intercepted test RPCs, not hosted acceptance.

## Connected staging acceptance — NOT EXECUTED for #229

PM/owner should use this PR's immutable preview with existing authorized staging users:

1. Inspect authorized Personal/Group pills on all six pages; no dropdown, accurate
   highlight and mobile scrolling. Dashboard must remain visibly personal.
2. Switch two groups with different saved summaries and a personal challenge;
   inspect distinct views, direct links, reload and meaningful page preservation.
3. On Weigh-ins enter disposable unsaved input and explicit checkbox choices;
   switch query-only pills and confirm they stay unchanged. Navigate away, choose
   Stay, then Discard; confirm no accidental save or carried-over input.
4. Verify canonical save/edit and draft/active sharing still work, notes remain
   author-private, and account switches hide previous contexts/history.

Leave the focused staging PR unmerged for independent PM review and owner acceptance.

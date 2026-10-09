# 16.9 — Group tabs and Record weight alignment

Issue #238. Originally based on staging `ee212008b9982510d6f356ee5b089848849d8c15`;
updated 2026-10-09 against `d0beba1735b74f3a36e27618b3327d4a9d5b7b42` after #246.
Latest staging was merged into the existing PR branch without rewriting history.

## Result

- Group's header now precedes its authorized group-only challenge row, with no
  Personal tracking pill or personal challenge links and exactly one context row.
- Record weight matches Dashboard's distance from the main app navbar on desktop
  and mobile. Challenges, My progress and Goals are unchanged. Canonical recording,
  private notes, correction behavior and explicit sharing remain unchanged.
- No-query and empty-query Group keep the first-group default. Explicit group
  selections remain truthful; unavailable or personal challenge IDs do not
  highlight a substitute or expose a personal destination from Group.
- Horizontal tab overflow, keyboard activation, loading/error guidance and
  account isolation remain in place. Personal Dashboard/home/Today remain free
  of challenge tabs and cards as delivered in #240.
- No schema, hosted SQL, auth, environment, production or ranking changes.
  Unrelated local Supabase metadata is excluded.
- The merged spreadsheet matrix, All members/member tabs, shared-history RPC,
  selected-member/context resets and recording refresh callback remain intact.
  Refresh shared progress stays in the content card below the sticky bar.
- The challenge row and page header are in normal page flow. Only the
  member tabs remain sticky; no nested vertical scroll traps the context row or
  Record weight on short/mobile screens. Keyboard focus offsets remain scoped
  to the sticky member tabs and scrollable history content.

## Local validation — 2026-10-08

- Format, lint, typecheck, build and diff checks pass. The existing bundle-size
  warning remains.
- 432 unit tests pass across 70 files.
- 75 browser tests pass: 71 application and 4 Group tests. New 1280px/390px
  tests compare the actual context/header/action geometry across four pages,
  assert no duplicate rows or page overflow, exercise keyboard selection,
  personal-context mapping, unavailable selections and account switching.
  Existing connected-service-intercepted Group tests check placement while
  preserving distinct authorized summaries and direct refresh selections.
  Canonical recording and personal Dashboard regression tests remain green.
- Read-only in-app visual inspection confirmed the populated synthetic Group
  row above the header and desktop action placement. All browser data was
  synthetic; no hosted data was changed.

## Refreshed integration validation — 2026-10-09

- Format, lint, typecheck, build and diff checks pass; existing bundle warning
  remains. 448 unit tests across 74 files pass, including empty-query default,
  group-only contexts and truthful unavailable selection.
- 79 browser tests pass: 71 application and 8 Group tests. The alignment cases
  compare desktop/mobile geometry with other challenge pages, check one context
  row, default/explicit/unavailable selections and account isolation. Group
  checks verify no nested vertical scroll and focused-action visibility on a
  short mobile viewport.
  The merged matrix/member/keyboard/sticky/privacy/refresh tests remain green.
- Read-only in-app synthetic visual checks confirmed challenge-row order and
  desktop action position. Browser checks at 390x568 confirmed that the normal
  page flow keeps the focused action visible without horizontal overflow. No
  connected data was modified or used as synthetic evidence.
- Against refreshed staging, only the Group page layout/selection, scoped focus
  CSS, alignment/browser assertions and this issue's notes differ. The merged
  chart/matrix/member components, model, repositories and SQL are unchanged.

## Navbar-reference correction — 2026-10-09

- Owner accepted group-only contexts and normal scrolling; requested Dashboard,
  not the other challenge pages, as the Record weight spacing reference.
- Group's compact header/action now precedes context tabs. The selected-group
  label and detailed shared-summary/privacy copy remain below the tabs. No other
  page or shared header component changed.
- Measured from the entire main app navbar's bottom to the action's top:
  Dashboard and Group both 40px at 1280x900 and 768x900, 212px at 390x568,
  and 244px at 320x568. Mobile retains the shared stacked header layout.
- Focused validation: 50 page/context unit tests, four responsive geometry
  browser tests, and eight Group history/member/sticky/privacy browser tests
  pass. Lint, app typecheck, production build, formatting and diff checks pass.
  No repeated full local suite; required CI runs on the updated commit.
- These are synthetic local measurements, not new connected owner acceptance.

## Updated connected preview acceptance — correction NOT EXECUTED

PM/owner should check the immutable PR preview on desktop and mobile:

1. Compare Group with Dashboard: Record weight has the same vertical distance
   from the main app navbar. Group's group-only context row is below its header.
2. Refresh Group without a query, with an empty query, and with explicit group
   selections. Active highlights match the displayed group; unavailable and
   personal IDs do not highlight a substitute. Confirm no Personal tracking
   pill or personal link appears on Group.
3. Use keyboard navigation and a short mobile viewport with many group
   contexts. The page scrolls normally, member tabs remain sticky, no nested
   vertical scroll traps the context row, and focused actions stay visible.
   Horizontal tab scrolling must not overflow the page.
4. Switch accounts: previous contexts and summaries disappear. Dashboard,
   personal home and Today still have no challenge tabs or cards.
5. Record weight still opens today's existing canonical entry with note/shares
   preserved, or a new private entry when none exists.

Leave the staging PR unmerged for independent PM review and owner acceptance.

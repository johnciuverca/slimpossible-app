# 16.9 — Group tabs and Record weight alignment

Issue #238, based on staging `ee212008b9982510d6f356ee5b089848849d8c15`.

## Result

- Group's existing authorized challenge row is now above the heading, outside the
  summary card. It uses the same full-width context area and 24px header gap as
  Challenges, My progress and Goals, with exactly one row.
- The unchanged shared Record weight header now has matching desktop top/right
  placement and mobile spacing below the heading text. Canonical recording,
  private notes, correction behavior and explicit sharing remain unchanged.
- No-query Group keeps its existing first-group default. Explicit selections
  remain truthful: an unavailable ID no longer highlights a different default
  group. Personal contexts retain their existing My progress destination.
- Horizontal tab overflow, keyboard activation, loading/error guidance and
  account isolation remain in place. Personal Dashboard/home/Today remain free
  of challenge tabs and cards as delivered in #240.
- No schema, hosted SQL, auth, environment, production or ranking changes.
  Unrelated local Supabase metadata is excluded.

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

## Connected preview acceptance — NOT EXECUTED

PM/owner should check the immutable PR preview on desktop and mobile:

1. Compare Group with Challenges, My progress and Goals: one context row above
   the heading, consistent header gap and Record weight placement.
2. Refresh Group without a query and with explicit group selections. Active
   highlights match the displayed context; unavailable IDs do not highlight a
   substitute group. A personal tab leads to its My progress view.
3. Use keyboard navigation and a narrow viewport with many contexts. Tabs scroll
   horizontally without page overflow and focused links remain usable.
4. Switch accounts: previous contexts and summaries disappear. Dashboard,
   personal home and Today still have no challenge tabs or cards.
5. Record weight still opens today's existing canonical entry with note/shares
   preserved, or a new private entry when none exists.

Leave the staging PR unmerged for independent PM review and owner acceptance.

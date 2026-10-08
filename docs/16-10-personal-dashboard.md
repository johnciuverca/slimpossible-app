# 16.10 — Personal Dashboard with create and invite actions

Issue #240, based on staging `571f26b` after #239.

## Result

- Dashboard, `/today` (including a stale challenge query), and signed-in personal
  home use personal weight, logged-today status, the 30-day trend and private
  history links. These routes render no challenge context tabs or summary cards.
  Challenge navigation remains available through the primary navigation.
- About you displays only the current session's email and available display name.
  No additional profile fields or editing were added; private weight notes are
  not shown on Dashboard.
- Create challenge opens the existing `/challenge/setup` flow.
- Invite people uses existing authorized visible challenges, filtered to draft or
  active group challenges owned by the current user. With one group, it links
  directly to `/challenge/invites?challenge=ID`. With several, the chooser starts
  unselected and requires an explicit group choice. With zero, it explains that
  a group challenge must be created first. Personal, archived and joined-only
  groups cannot become Dashboard invitation destinations.
- The Dashboard never creates or sends invitations. Invitation creation remains
  an explicit action in the existing invite page. Loading/errors provide guidance
  independently of personal recording; account changes clear chooser state and
  hide old group choices synchronously.
- The shared Record weight action and canonical correction/new-private-entry
  behavior from #236 are retained.

#238's Group alignment is deferred separately. No schema, SQL, production,
auth/environment, ranking, or invitation persistence changes.

## Local validation — 2026-10-08

- Format/lint/typecheck/build/diff checks pass. Existing bundle-size warning remains.
- 432 unit tests pass across 70 files. Owned-group zero/one/multiple filtering,
  no invitation creation, account changes, optional-context errors and canonical
  sharing/correction tests pass. Dashboard no longer requests group summary RPCs.
- 73 browser tests pass (69 application + 4 group). Desktop/mobile coverage checks
  personal route aliases, absent tabs/cards, authorized session fields, create
  destination, explicit chooser/reset, existing invite destination and no issued
  invites. Existing canonical privacy/focus/account isolation/navigation coverage
  remains green.
- Read-only in-app visual inspection confirmed personal weight/trend, About you,
  Create challenge and Invite people presentation. All browser data was synthetic;
  no connected account or hosted database was changed.

## Connected preview acceptance — NOT EXECUTED

PM/owner should inspect the immutable PR preview at desktop/mobile widths:

1. Dashboard, `/today`, and personal home have no challenge tabs/cards; Challenges
   remains reachable through navigation.
2. Weight/trend/history and Logged today remain personal. Record weight opens
   today's existing entry with note/shares preserved, or a new private entry.
3. About you shows only the current account's existing session name/email.
4. Create challenge opens setup. Invite people directs a sole owner group, offers
   an explicit choice for several, or gives create-group guidance for none.
5. Reaching the invite page does not create/send an invitation. Switching accounts
   clears an open chooser and previously selected invitation destination.

Leave the focused staging PR unmerged for PM review and owner preview confirmation.

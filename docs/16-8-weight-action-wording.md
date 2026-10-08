# 16.8 — Consistent Record weight action across pages

Issue #236, PR #239, based on staging `2a1af0d`.

## Behavior

- Dashboard, Challenges, My Progress (including selected challenge progress),
  Group, Goals, and full Weigh-ins use the shared `WeightPageHeader`: the primary
  **Record weight** action sits at the top right on desktop and below the header
  text on mobile. Competing weight-entry links were removed.
- The main action always says **Record weight**. Dashboard's **Logged today**
  remains a separate status. Record pencils retain `Edit weight YYYY-MM-DD`.
- Modal actions load today's canonical entry with its ID, private note and
  explicit shares when present. Otherwise they start a private new entry.
  Editor headings and submission labels distinguish Record/Save from Edit/Update.
- Group and Goals recording loads personal history independently of challenge
  membership, selected context, and optional challenge-loading failures. Existing
  shared entries remain protected if group eligibility cannot be verified.
- The full-page action focuses and scrolls to the weight field. An unfinished
  draft is resumed intact, even when today already has a saved record. With no
  draft it loads today's record or an empty new form. Editing remounts the form's
  navigation baseline and restores focus after rendering.
- A new full-page form targeting an existing date is rejected with edit guidance,
  preserving the existing note and shares. Explicit corrections use that record's
  ID; conflicting date edits retain the repository's duplicate-date error.
- Modal dismissal and successful saves restore focus to the invoking control;
  account changes hide the old editor and clear its state.

No schema, SQL, ranking, auth/environment, hosted or production changes.
Dashboard's personal-only redesign is #240; Group tab alignment is #238.
Neither follow-up is included. Standalone concept preview labels are unchanged.

## Validation — 2026-10-08

- Format, lint, typecheck, production build and diff checks pass. The existing
  large-bundle warning remains.
- 428 unit tests pass in 70 files. New Group/Goals cases verify recording and
  correction without usable challenge data. Existing account isolation, private
  notes, canonical saves and explicit-sharing checks pass.
- 65 browser tests pass (61 application + 4 group). Desktop/mobile cases cover
  one primary action, shared header placement,
  empty private editors on every page, correction of today's entry from every
  page, unchanged notes/shares, one canonical row, full-page draft preservation
  and Stay/Discard navigation.
- Focus after successful save was additionally verified at both viewport sizes.
- Local in-app visual inspection confirms the Group header/action is available
  with no challenge membership and positioned consistently outside the content card.
- Existing challenge-view unit tests isolate the independent personal action
  from their ordered HTTP fixtures; real action behavior is covered by the
  personal workspace and cross-page browser suites.

## Connected staging acceptance — NOT EXECUTED

On the immutable PR preview, PM/owner should check the main Record weight action
on all six pages at desktop and mobile widths. With a disposable authorized
account, save a private entry, reopen it from another page, and confirm Update
weight, the private note and any explicit group selections are preserved. Check
Group/Goals without a selected challenge. On full Weigh-ins, enter an unfinished
draft and use Record weight: the input and focus must be retained. Logged today
must not change the main action label.

Leave PR #239 unmerged for independent review and owner preview acceptance.

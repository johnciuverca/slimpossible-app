# 16.8 — Consistent weight-action wording

Issue #236, based on staging `2a1af0d` after #237.

## Changes

- New-entry actions use **Record weight** across Dashboard, Challenges, My Progress
  and challenge-view entry links. Existing record actions use **Edit weight**.
- Dashboard retains **Logged today** plus **Edit weight** when today's canonical
  entry exists; otherwise the action is **Record weight**.
- Full-page and legacy compatibility editor headings switch between **Record
  weight** and **Edit weight**, with **Save weight** / **Update weight** submission
  labels. The canonical full-page field section is neutrally named Weight details.
- Record-card icon names retain the unique date: `Edit weight YYYY-MM-DD`. Edit
  tooltips retain weight and date; delete identifiers/confirmation are unchanged.
- The existing modal already used the requested headings and submission wording.
  Related no-record placeholder text now uses Record weight consistently.

Only text and label assertions changed. Canonical saves, dates, optional explicit
sharing, author-private notes, account isolation, editors and navigation guards
are unchanged. Standalone design-concept preview labels are not live application
actions and are intentionally outside this change.

No schema, SQL, ranking, auth/environment, hosted or production changes.
**#238's lower Group-tab placement is not fixed by this PR.**

## Local evidence — 2026-10-08

- Format/lint/typecheck/build/diff checks passed; existing large-bundle warning remains.
- 426 unit tests passed across 70 files. Strengthened Dashboard assertions cover
  no-today Record weight versus Logged today/Edit weight, without a duplicate
  Record weight action after saving.
- 61 browser tests passed (57 application + 4 group). Desktop/mobile keyboard tests
  use the new action names and assert Edit weight headings/Update weight labels in
  modal and fallback editors, while preserving date-specific icon identities.
- Existing canonical sharing, private notes, account switches, Stay/Discard,
  challenge navigation, refresh, delete and empty-state coverage remains passing.
- Local in-app visual smoke inspected the canonical full-page Record weight title,
  Save weight action and date-labelled Edit weight icon.
- Initial format and test-only type failures were corrected before the passing
  quality run. Browser fixtures are synthetic; no hosted acceptance was performed.

## Connected staging acceptance — NOT EXECUTED for #236

PM/owner should inspect the immutable preview: Dashboard without today's entry
shows Record weight; after an authorized disposable save it shows Logged today and
Edit weight. Check new-entry links in Challenges and My Progress, modal/fallback
Record/Edit headings and Save/Update buttons, and keyboard record-icon names.
Existing canonical/sharing/privacy and Stay/Discard behavior must stay unchanged.
The known Group positioning inconsistency remains separately queued in #238.

Leave this focused staging PR unmerged for PM review and owner acceptance.

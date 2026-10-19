# 16.5 — Connected sharing release gate status

Status snapshot recorded 2026-10-19 for staging candidate
`00fcf280bd3be0d54ea3497679d23e80633207d4`. This is partial evidence for
issues #207, #212, and #155. It is not production approval, a hosted migration
attestation, or authorization to close any issue.

## Verified on this candidate

- **#212 connected sharing/privacy flow: PASS for the observed path.** Using a
  disposable test record, group-only sharing was saved, then edited to share
  with both selected groups. Both groups showed the entry without its private
  note. The entry was deleted, and refreshing both groups confirmed it was
  absent. Existing records remained; no production data was involved.
- **Signed-out route: PASS for `/dashboard` only.** Incognito direct navigation
  redirected to the app's `/login` route. Other protected routes and the wider
  navigation/reload matrix were not established by this observation.
- **Local SQL/migration harness: PASS, local only.** Run from this exact
  candidate, it applied the timestamp-ordered migration set and passed 17
  permission cases and 15 group-history projection cases. This does not prove
  that the hosted staging database has the same schema, grants, or migration
  ledger.

## Still not executed

| Gate                                                                               | Status       |
| ---------------------------------------------------------------------------------- | ------------ |
| #155 solo registration, confirmation, sign-in, and saved solo progress             | NOT EXECUTED |
| #155 group invitation acceptance by a second user                                  | NOT EXECUTED |
| #155 valid mailbox recovery/reset and used/expired provider links                  | NOT EXECUTED |
| Recovery/network failure induced against the connected provider                    | NOT EXECUTED |
| Two-member Sunday ranking and late/corrected-record result after refresh           | NOT EXECUTED |
| Full #207 protected-route, loading/empty/error, and membership matrix              | NOT EXECUTED |
| Mobile viewport and keyboard/focus acceptance matrix                               | NOT EXECUTED |
| Read-only reconciliation of hosted migration history/schema against this candidate | NOT EXECUTED |

Local unit, component, E2E-fallback, and SQL tests remain separate from those
connected journeys. The local SQL results are summarized above; they must not
be presented as hosted database evidence.

## Migration and rollback inventory

The exact candidate contains 17 timestamped migration files. The full
candidate-specific list and the eight checked-in rollback scripts are recorded
in the [release workflow](release-workflow.md) and
[staging setup handoff](supabase-staging-setup.md). Rollback scripts exist for
only a subset; their presence is not an instruction to execute them. No
statement is made here about which migrations the hosted staging ledger has
recorded. Production configuration, migrations, deployment, and rollback
remain separate owner-approved gates.

This status snapshot changes no staging or production settings/data and does
not close #207, #212, or #155. The remaining connected gates above must be
completed and reviewed before considering live release sync.

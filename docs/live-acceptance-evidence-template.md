# Live account and persistence acceptance record

Use this record only for the owner-run, non-production acceptance run in Issue
#148. It is deliberately blank and is **not evidence that any live test has
executed**. Keep completed evidence redacted: no email addresses, passwords,
access tokens, project URLs, anonymous keys, user IDs, raw weights, or private
notes belong here or in a pull request.

## Run metadata

- Date and time (with timezone): **NOT EXECUTED**
- Tester: **NOT EXECUTED**
- Non-production environment label: **NOT EXECUTED**
- Application commit or deployment label: **NOT EXECUTED**
- Dedicated disposable identities prepared: **NOT EXECUTED**

## Preconditions

The owner must use a dedicated non-production Supabase project and a dedicated
test mailbox. Email authentication, the checked-in migrations, and the
documented same-origin verification and recovery redirects must already be
configured by the owner. Do not place any configured value in this file.

## Acceptance steps and redacted result

Record each line as `pass`, `fail`, or `blocked`, with a short observation
that contains no sensitive or health data.

| Flow                                                                                | Result       | Redacted observation / blocker |
| ----------------------------------------------------------------------------------- | ------------ | ------------------------------ |
| Disposable user A registers, confirms email, and signs in                           | NOT EXECUTED | —                              |
| User A profile has the expected display name after refresh                          | NOT EXECUTED | —                              |
| User A creates a challenge and a membership linked to that user                     | NOT EXECUTED | —                              |
| User A creates a weigh-in using non-personal sample data                            | NOT EXECUTED | —                              |
| User A corrects the same calendar date; exactly one record remains                  | NOT EXECUTED | —                              |
| User A signs out, signs in again, and sees only their saved records                 | NOT EXECUTED | —                              |
| User B cannot read or edit User A profile, challenge, membership, weigh-in, or note | NOT EXECUTED | —                              |
| Anonymous access cannot read account-owned records                                  | NOT EXECUTED | —                              |

## Evidence standard

For each `pass`, retain a dated redacted browser observation and, where needed,
a redacted owner-observed table result. A written checklist, mocked test, or
CI result is not executed live evidence. If a flow is `blocked` or `fail`, keep
Issue #148 and its parent open and record the exact non-sensitive blocker.

## Cleanup

After the run, the owner may remove only the explicitly identified disposable
test identities and their associated non-production rows. Do not delete
unidentified data or modify production data.

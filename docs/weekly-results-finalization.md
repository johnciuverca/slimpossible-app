# Weekly result finalization (issue #404)

## Behavior

- Sunday result values use explicit challenge shares captured as immutable source events. Notes, photos, and unshared weights are not copied into the outbox or result display.
- An actual shared Sunday value wins over an estimate. A missing Sunday may interpolate between the nearest eligible shared actual records on either side, rounded to 0.05 kg. The calculation never extrapolates or uses an estimate as an endpoint.
- Membership and endpoint eligibility are evaluated as of the cutoff. Pre-join endpoints are excluded. Only source events with PostgreSQL commit timestamps strictly before the cutoff qualify.
- The provisional dashboard state begins Sunday at 20:00 Europe/Bucharest. It remains revisable through Monday at 20:00. Finalization requires a durable post-cutoff barrier, then writes a challenge-scoped immutable award. Retries leave that award unchanged.
- Finalized winner details retain an opaque member key and whether either locked Sunday value was interpolated. The dashboard labels only those winners with “Includes estimated weight”; later weigh-in edits cannot change the award label.
- Historical weekly counts continue using the existing calculation before the configured rollout Sunday. New weeks contribute only finalized awards; provisional results do not change standings. No historical awards are generated automatically.
- `effective_from_sunday` stays unset until the owner chooses the first eligible rollout Sunday through the restricted initializer. Its Sunday 20:00 Bucharest provisional cutoff must still be in the future when initialized. That exact Sunday is eligible for immutable finalization; earlier Sundays remain on the unchanged legacy path and are never backfilled.

## Activation is not part of this migration

The migration creates the publication, SQL consumer functions, and an initializer. Applying it does not collect weigh-in, membership, or barrier events: capture remains disabled until the restricted initializer inserts its control row. Initialization takes source-table share locks, discards pre-slot outbox rows, and snapshots current memberships and currently shared actual weigh-ins in one baseline. Those explicitly shared actuals, including older recorded dates, may serve as endpoints for the first eligible Sunday if the baseline transaction commits before its provisional cutoff; no historical awards are created. Account-erasure/retention approval is required before initialization begins collection.

The migration does not create a slot, enable `pg_cron`, schedule jobs, or set an effective date. Those operations need a separate staging approval and a current capability check. Staging had no `pg_cron` extension or logical slots at the last inventory; verify again before planning activation.

The membership boundary uses Bucharest calendar dates for recorded weigh-in dates and also requires the source event to have committed after that membership episode began. Per-weigh-in transaction locks serialize source edits with share insert/update/delete operations so their snapshots follow committed share state. A date/user change or share-scope change emits an unshared tombstone for the old identity/date, then the currently shared value for the new identity/date in the same transaction. If a challenge is deleted before queued outbox events are consumed, the consumer discards those challenge-scoped events and advances its durable watermark; cascading result evidence is removed with the challenge.

After approval, the operator plan is:

1. Apply and review the migration on staging.
2. Confirm `wal_level = logical`, available slot/WAL capacity, and that `pg_cron` is available and preloaded. Do not infer extension availability from a local PostgreSQL test.
3. Create the fixed `pgoutput` slot `slimpossible_group_weekly_results_v1` after the publication exists. Slot creation is a standalone operation.
4. After retention approval, choose a first eligible rollout Sunday whose Sunday 20:00 Bucharest provisional cutoff is still ahead, then call `initialize_group_weekly_results(date)` once. The initializer takes share locks on membership and weigh-in source tables, verifies the logical slot, discards pre-slot outbox rows, and snapshots current membership plus explicitly shared actual values. Those snapshot weights can support the first eligible result if the initializer commits before that cutoff. This is a prospective baseline, not an award backfill.
5. Schedule independent one-minute jobs for:

   ```sql
   select cron.schedule(
     'weekly-result-barrier', '* * * * *',
     'select public.capture_group_weekly_barrier();'
   );
   select cron.schedule(
     'weekly-result-persist', '* * * * *',
     'select public.persist_group_weekly_result_events();'
   );
   select cron.schedule(
     'weekly-result-ack', '* * * * *',
     'select public.ack_group_weekly_result_events();'
   );
   select cron.schedule(
     'weekly-result-finalize', '* * * * *',
     'select public.finalize_due_group_weekly_results();'
   );
   ```

   The persist and acknowledge calls must remain separate invocations. Repeated calls are safe; advisory locks serialize workers. A delayed barrier leaves results pending and does not relax the cutoff.

## Failure handling and retention

- The consumer validates database/system identity, slot name/plugin/database, WAL status, relation OID/schema, and transaction framing. Unknown messages, missing/lost WAL, slot movement beyond durable evidence, and schema drift fail closed. It never recreates a slot automatically.
- Monitor `pg_replication_slots` and WAL retention. If the slot is lost or WAL is unreserved/lost, stop finalization and resolve the gap explicitly; do not advance or recreate the slot as a recovery shortcut.
- Raw event tables are inaccessible to client roles and are scoped to challenges with `ON DELETE CASCADE`. Challenge deletion removes its source evidence and finalized awards. The global barrier ledger retains only the latest barrier; award rows store the barrier LSN/time.
- Account erasure still needs an owner decision. Source snapshots and finalized winner display names can contain identifying data, while the award immutability rule argues against silently rewriting past awards. Do not activate hosted collection until the retention/erasure behavior is approved.

## Evidence limits

`supabase/tests/run_local_group_weekly_result_consumer.sh` exercises the migration, a real PostgreSQL 16 `pgoutput` slot, separate persist/ack transactions, replay, client ACLs, concurrent source edits with share deletion/insertion, finalization/ties, cutoff exclusion, and fail-closed schema/slot recreation. It is a disposable local proof. It does not establish Supabase staging permissions, `pg_cron` availability, WAL-capacity suitability, alerting, or production execution latency.

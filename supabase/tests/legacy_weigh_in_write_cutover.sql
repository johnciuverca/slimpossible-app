-- Rollback-only local contract for the separately gated #247 cutover.
-- Run only in the disposable local DB created by run_local_data_api_grants.sh.
-- This is not connected staging/production acceptance.

begin;

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000002', '[#247 test] legacy member')
on conflict (id) do nothing;

insert into public.challenges (
  id, owner_id, created_by, name, start_date, end_date, status, challenge_kind
) values (
  '24700000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  '[#247 test] legacy challenge', current_date - 30, current_date + 30,
  'active', 'group'
);

insert into public.participants (
  id, challenge_id, user_id, display_name, status,
  starting_weight_kg, target_weight_kg, joined_at
) values (
  '24700000-0000-4000-8000-000000000002',
  '24700000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '[#247 test] legacy member', 'active', 90, 80, now()
);

insert into public.weigh_ins (
  id, participant_id, recorded_date, weight_kg, note
) values (
  '24700000-0000-4000-8000-000000000003',
  '24700000-0000-4000-8000-000000000002',
  current_date - 2, 90, 'preserve this legacy source row'
);

-- Exercise the exact manually gated SQL, then roll its ACL change back below.
\i supabase/post-deploy/disable_legacy_weigh_in_writes.sql

set local role authenticated;
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true
);

do $$
declare
  rejected_insert boolean := false;
  rejected_update boolean := false;
  legacy_count integer;
  legacy_weight numeric;
  canonical_id uuid;
begin
  begin
    insert into public.weigh_ins (
      participant_id, recorded_date, weight_kg, note
    ) values (
      '24700000-0000-4000-8000-000000000002',
      current_date - 1, 89, 'stale client insert'
    );
  exception when insufficient_privilege then
    rejected_insert := true;
  end;

  begin
    update public.weigh_ins
    set weight_kg = 88, note = 'stale client update'
    where id = '24700000-0000-4000-8000-000000000003';
  exception when insufficient_privilege then
    rejected_update := true;
  end;

  if not rejected_insert or not rejected_update then
    raise exception 'Expected legacy INSERT and UPDATE to fail with SQLSTATE 42501';
  end if;

  select count(*)::integer, min(weight_kg)
  into legacy_count, legacy_weight
  from public.weigh_ins
  where participant_id = '24700000-0000-4000-8000-000000000002';
  if legacy_count <> 1 or legacy_weight <> 90 then
    raise exception 'Rejected legacy writes changed or duplicated the source row';
  end if;

  select saved.id into canonical_id
  from public.save_personal_weigh_in(
    null, current_date - 1, 89, 'canonical path remains available', '{}'::uuid[]
  ) as saved;
  if canonical_id is null or not exists (
    select 1 from public.personal_weigh_ins
    where id = canonical_id
      and user_id = auth.uid()
      and recorded_date = current_date - 1
      and weight_kg = 89
  ) then
    raise exception 'Canonical save_personal_weigh_in did not remain available';
  end if;
end;
$$;

reset role;
rollback;

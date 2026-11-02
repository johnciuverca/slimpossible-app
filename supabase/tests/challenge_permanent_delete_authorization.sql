-- Disposable local database only. Never run against staging or production.
\set ON_ERROR_STOP on

create schema delete_challenge_test;
create function delete_challenge_test.denied(command text) returns void
language plpgsql as $$
begin
  begin
    execute command;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'Expected authorization denial: %', command;
end $$;
grant usage on schema delete_challenge_test to anon, authenticated;
grant execute on function delete_challenge_test.denied(text) to anon, authenticated;

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Delete owner'),
  ('00000000-0000-4000-8000-000000000002', 'Other user');

insert into public.challenges(
  id, owner_id, created_by, challenge_kind, name, start_date, end_date,
  status, archived_from_status
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'group', 'Archived target', current_date - 10, current_date + 20, 'active', null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'group', 'Other group', current_date - 10, current_date + 20, 'active', null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'group', 'Active target', current_date - 10, current_date + 20, 'active', null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'personal', 'Personal challenge', current_date - 10, current_date + 20, 'active', null);

insert into public.participants(
  id, challenge_id, user_id, display_name, status, starting_weight_kg,
  target_weight_kg, joined_at
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Owner in target', 'active', 90, 80, now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Owner in other', 'active', 90, 80, now());

insert into public.weigh_ins(id, participant_id, recorded_date, weight_kg, note)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', current_date, 89, 'Target group note'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', current_date, 88, 'Other group note');

insert into public.personal_weigh_ins(
  id, user_id, recorded_date, weight_kg, note
) values (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001', current_date, 89,
  'Private note preserved'
);
insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.personal_weigh_in_legacy_map(
  legacy_weigh_in_id, personal_weigh_in_id, challenge_id,
  legacy_share_with_group
) values (
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', false
);
insert into public.challenge_invites(id, challenge_id, created_by, token_hash, expires_at)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', repeat('a', 64), now() + interval '1 day'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', repeat('b', 64), now() + interval '1 day');
insert into public.participant_target_milestones(
  id, challenge_id, participant_id, target_weight_kg
) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 80),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 80);

update public.challenges
set status = 'archived'
where id = '10000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
set role authenticated;
select delete_challenge_test.denied($q$select public.delete_archived_group_challenge('10000000-0000-4000-8000-000000000001')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
do $$ begin
  begin
    perform public.delete_archived_group_challenge('10000000-0000-4000-8000-000000000003');
    raise exception 'active challenge deletion was allowed';
  exception when invalid_parameter_value then null;
  end;
end $$;
select delete_challenge_test.denied($q$select public.delete_archived_group_challenge('10000000-0000-4000-8000-000000000004')$q$);
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select delete_challenge_test.denied($q$select public.delete_archived_group_challenge('10000000-0000-4000-8000-000000000001')$q$);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
set role authenticated;
select public.delete_archived_group_challenge('10000000-0000-4000-8000-000000000001');
reset role;

do $$ begin
  if exists (select 1 from public.challenges where id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target challenge remains';
  end if;
  if exists (select 1 from public.participants where challenge_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target members remain';
  end if;
  if exists (select 1 from public.weigh_ins where id = '30000000-0000-4000-8000-000000000001') then
    raise exception 'target group weigh-in remains';
  end if;
  if exists (select 1 from public.challenge_invites where challenge_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target invitation remains';
  end if;
  if exists (select 1 from public.participant_target_milestones where challenge_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target milestone remains';
  end if;
  if exists (select 1 from public.personal_weigh_in_group_shares where challenge_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target share remains';
  end if;
  if exists (select 1 from public.personal_weigh_in_legacy_map where challenge_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'target legacy mapping remains';
  end if;
  if not exists (
    select 1 from public.personal_weigh_ins
    where id = '40000000-0000-4000-8000-000000000001'
      and note = 'Private note preserved'
  ) then raise exception 'canonical personal record or private note was deleted'; end if;
  if not exists (
    select 1 from public.personal_weigh_in_group_shares
    where personal_weigh_in_id = '40000000-0000-4000-8000-000000000001'
      and challenge_id = '10000000-0000-4000-8000-000000000002'
  ) then raise exception 'other challenge share was deleted'; end if;
  if not exists (select 1 from public.challenges where id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'other challenge was deleted';
  end if;
  if not exists (select 1 from public.weigh_ins where id = '30000000-0000-4000-8000-000000000002') then
    raise exception 'other challenge weigh-in was deleted';
  end if;
  if not exists (select 1 from public.challenge_invites where challenge_id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'other challenge invitation was deleted';
  end if;
  if not exists (select 1 from public.participant_target_milestones where challenge_id = '10000000-0000-4000-8000-000000000002') then
    raise exception 'other challenge milestone was deleted';
  end if;
  if not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'profile was deleted';
  end if;
  if not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'auth account was deleted';
  end if;
end $$;

\echo PASS permanent deletion authorization and preservation

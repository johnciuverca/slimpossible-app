-- Rollback-only contract; use only explicitly approved disposable Auth users.
\set ON_ERROR_STOP on
begin;
select set_config('slimpossible.personal_owner_id', 'REPLACE_OWNER_UUID', true);
select set_config('slimpossible.personal_member_id', 'REPLACE_MEMBER_UUID', true);
select set_config('slimpossible.personal_outsider_id', 'REPLACE_OUTSIDER_UUID', true);

do $$
declare
  owner_id uuid := current_setting('slimpossible.personal_owner_id')::uuid;
  member_id uuid := current_setting('slimpossible.personal_member_id')::uuid;
  outsider_id uuid := current_setting('slimpossible.personal_outsider_id')::uuid;
  draft_group uuid := gen_random_uuid();
  legacy_group uuid := gen_random_uuid();
  personal_group uuid := gen_random_uuid();
  member_participant uuid := gen_random_uuid();
  saved_entry uuid;
  owner_entry uuid;
  lifecycle text;
  member_status text;
  observation record;
begin
  if owner_id = member_id or owner_id = outsider_id or member_id = outsider_id
     or (select count(*) from auth.users where id in (owner_id, member_id, outsider_id)) <> 3 then
    raise exception 'Three distinct approved disposable Auth users required';
  end if;
  insert into public.profiles(id, display_name) values
    (owner_id, '[eligibility] owner'), (member_id, '[eligibility] member'),
    (outsider_id, '[eligibility] outsider') on conflict(id) do nothing;
  -- Same inputs as setup: status omitted, group kind explicit. Also test NULL legacy kind.
  insert into public.challenges(id, owner_id, created_by, name, start_date, end_date, challenge_kind)
  values
    (draft_group, owner_id, owner_id, '[eligibility] setup', current_date-30, current_date+30, 'group'),
    (legacy_group, owner_id, owner_id, '[eligibility] legacy', current_date-30, current_date+30, null),
    (personal_group, owner_id, owner_id, '[eligibility] personal', current_date-30, current_date+30, 'personal');
  if (select status from public.challenges where id=draft_group) <> 'draft' then
    raise exception 'Setup default must be draft';
  end if;
  insert into public.participants(id, challenge_id, user_id, display_name, status, starting_weight_kg, target_weight_kg, joined_at)
  values(member_participant, draft_group, member_id, '[eligibility] member', 'active', 90, 80, now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select id into owner_entry from public.save_personal_weigh_in(null, current_date-1, 90, 'private owner note', array[draft_group, legacy_group]);
  if owner_entry is null then raise exception 'Draft owner sharing failed'; end if;
  begin
    perform * from public.save_personal_weigh_in(owner_entry, current_date-1, 89, null, array[personal_group]);
    raise exception 'Personal challenge sharing was accepted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select id into saved_entry from public.save_personal_weigh_in(null, current_date-1, 90, 'private member note', array[draft_group]);
  perform * from public.save_personal_weigh_in(saved_entry, current_date-1, 89, 'corrected private note', array[draft_group]);
  select * into observation from public.list_my_personal_weigh_ins() where id=saved_entry;
  if observation.weight_kg <> 89 or observation.note <> 'corrected private note'
     or observation.shared_challenge_ids <> array[draft_group] then
    raise exception 'Draft correction lost original share or private data';
  end if;
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.save_personal_weigh_in(null, current_date-1, 88, null, array[draft_group]);
    raise exception 'Draft outsider sharing was accepted';
  exception when insufficient_privilege then null;
  end;
  if exists(select 1 from public.list_my_personal_weigh_ins() where recorded_date=current_date-1) then
    raise exception 'Rejected outsider request partially saved';
  end if;
  foreach member_status in array array['invited','withdrawn','completed'] loop
    execute 'reset role';
    update public.participants set status=member_status where id=member_participant;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', member_id::text, true);
    begin
      perform * from public.save_personal_weigh_in(saved_entry, current_date-1, 88, null, array[draft_group]);
      raise exception 'Nonactive member sharing accepted: %', member_status;
    exception when insufficient_privilege then null;
    end;
  end loop;
  execute 'reset role';
  update public.participants set status='active' where id=member_participant;
  foreach lifecycle in array array['completed','archived'] loop
    update public.challenges set status=lifecycle where id=draft_group;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    begin
      perform * from public.save_personal_weigh_in(owner_entry, current_date-1, 88, null, array[draft_group]);
      raise exception 'Closed lifecycle owner sharing accepted: %', lifecycle;
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claim.sub', member_id::text, true);
    begin
      perform * from public.save_personal_weigh_in(saved_entry, current_date-1, 88, null, array[draft_group]);
      raise exception 'Closed lifecycle member sharing accepted: %', lifecycle;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
  end loop;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select * into observation from public.list_my_personal_weigh_ins() where id=saved_entry;
  if observation.weight_kg <> 89 or observation.note <> 'corrected private note'
     or observation.shared_challenge_ids <> array[draft_group] then
    raise exception 'Denied correction mutated canonical data or sharing';
  end if;
  execute 'reset role';
  update public.challenges set status='active' where id=draft_group;
  execute 'set local role authenticated';
  perform * from public.save_personal_weigh_in(saved_entry, current_date-1, 88, 'active correction', array[draft_group]);
  execute 'reset role';
end $$;
select 'PASS draft/active owner/member eligibility, legacy NULL kind, share preservation, lifecycle and negative authorization' as result;
rollback;

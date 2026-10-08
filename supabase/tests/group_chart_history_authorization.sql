-- Staging only, rollback only. Owner supplies three existing approved disposable
-- Auth UUIDs privately. Do not create identities or run against Production.
begin;
select set_config('slimpossible.chart_owner', 'REPLACE_OWNER_UUID', true);
select set_config('slimpossible.chart_member', 'REPLACE_MEMBER_UUID', true);
select set_config('slimpossible.chart_outsider', 'REPLACE_OUTSIDER_UUID', true);
create temp table chart_checks (check_name text, passed boolean);
grant all on chart_checks to authenticated;
do $$
declare
  owner_id uuid := current_setting('slimpossible.chart_owner')::uuid;
  member_id uuid := current_setting('slimpossible.chart_member')::uuid;
  outsider_id uuid := current_setting('slimpossible.chart_outsider')::uuid;
  group_id uuid := gen_random_uuid();
  draft_id uuid := gen_random_uuid();
  personal_id uuid := gen_random_uuid();
  early_id uuid := gen_random_uuid();
  late_id uuid := gen_random_uuid();
  future_id uuid := gen_random_uuid();
  private_id uuid := gen_random_uuid();
  count_rows integer;
  key_before text;
  row_json jsonb;
begin
  if owner_id = member_id or owner_id = outsider_id or member_id = outsider_id
     or (select count(*) from auth.users where id in (owner_id, member_id, outsider_id)) <> 3 then
    raise exception 'Three distinct existing approved disposable Auth users are required.';
  end if;
  insert into public.profiles (id, display_name) values
    (owner_id, 'Chart disposable owner'), (member_id, 'Chart disposable member')
    on conflict (id) do nothing;
  insert into public.challenges (id,owner_id,created_by,name,start_date,end_date,status,challenge_kind) values
    (group_id,owner_id,owner_id,'Chart disposable active',current_date-30,current_date+30,'active','group'),
    (draft_id,owner_id,owner_id,'Chart disposable draft',current_date-30,current_date+30,'draft','group'),
    (personal_id,owner_id,owner_id,'Chart disposable personal',current_date-30,current_date+30,'active','personal');
  insert into public.participants (challenge_id,user_id,display_name,status,starting_weight_kg,target_weight_kg,joined_at) values
    (group_id,owner_id,'Same name','active',100,90,now()),
    (group_id,member_id,'Same name','active',90,80,now()),
    (draft_id,member_id,'Same name','active',90,80,now());
  -- Direct fixture insertion also probes future filtering; UI save forbids it.
  insert into public.personal_weigh_ins (id,user_id,recorded_date,weight_kg,note) values
    (early_id,member_id,current_date-3,90,'private shared-row note'),
    (late_id,member_id,current_date-1,88.5,'private correction note'),
    (future_id,member_id,current_date+1,20,'private future note'),
    (private_id,member_id,current_date-2,30,'private-only note');
  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id,challenge_id) values
    (early_id,group_id),(late_id,group_id),(future_id,group_id),(early_id,draft_id);
  execute 'set local role anon';
  begin
    perform * from public.get_group_chart_history(group_id);
    raise exception 'Anonymous chart access was allowed.';
  exception when insufficient_privilege then null;
  end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.get_group_chart_history(group_id);
    raise exception 'Sessionless chart access was allowed.';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into count_rows from public.get_group_chart_history(group_id);
  insert into chart_checks values ('member_only_shared_nonfuture', count_rows=2);
  select member_key, to_jsonb(history) into key_before,row_json from public.get_group_chart_history(group_id) history limit 1;
  insert into chart_checks values ('projection_no_notes_emails_raw_ids',
    not row_json ? 'note' and not row_json ? 'email' and not row_json ? 'user_id' and not row_json ? 'participant_id');
  insert into chart_checks values ('group_scoped_opaque_key',
    key_before <> member_id::text and key_before <> (select member_key from public.get_group_chart_history(draft_id) limit 1));
  insert into chart_checks values ('draft_selected_group_only', (select count(*) from public.get_group_chart_history(draft_id))=1);
  begin
    perform * from public.get_group_chart_history(personal_id);
    raise exception 'Personal challenge chart access was allowed.';
  exception when insufficient_privilege then null;
  end;
  perform * from public.save_personal_weigh_in(late_id,current_date-1,89,'still private',array[group_id]);
  insert into chart_checks values ('correction_updates_exact_weight',
    (select weight_kg from public.get_group_chart_history(group_id) where recorded_date=current_date-1)=89);
  perform * from public.save_personal_weigh_in(null,current_date-5,91,'private late baseline',array[group_id]);
  insert into chart_checks values ('late_entry_recorded_date_not_created_date',
    (select min(recorded_date) from public.get_group_chart_history(group_id))=current_date-5);
  perform * from public.save_personal_weigh_in(early_id,current_date-3,90,'private unshared',array[draft_id]);
  insert into chart_checks values ('unshare_removes_only_selected_group_row',
    not exists(select 1 from public.get_group_chart_history(group_id) where recorded_date=current_date-3)
    and exists(select 1 from public.get_group_chart_history(draft_id) where recorded_date=current_date-3));
  perform * from public.delete_personal_weigh_in(late_id);
  insert into chart_checks values ('delete_removes_chart_row',
    not exists(select 1 from public.get_group_chart_history(group_id) where recorded_date=current_date-1));
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  begin
    perform * from public.get_group_chart_history(group_id);
    raise exception 'Outsider chart access was allowed.';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*) into count_rows from public.get_group_chart_history(group_id);
  insert into chart_checks values ('owner_authorized_without_raw_row_access',count_rows=1);
  execute 'reset role';
  insert into public.personal_weigh_ins (user_id,recorded_date,weight_kg,note)
    values(owner_id,current_date-5,100,'private owner note');
  insert into public.personal_weigh_in_group_shares (personal_weigh_in_id,challenge_id)
    select id,group_id from public.personal_weigh_ins where user_id=owner_id and recorded_date=current_date-5;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  insert into chart_checks values ('duplicate_names_distinct_member_keys',
    (select count(distinct member_key) from public.get_group_chart_history(group_id))=2);
  execute 'reset role';
  update public.participants set status='withdrawn' where challenge_id=group_id and user_id=member_id;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform * from public.get_group_chart_history(group_id);
    raise exception 'Withdrawn viewer chart access was allowed.';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into chart_checks values ('withdrawn_author_rows_hidden',
    (select count(*) from public.get_group_chart_history(group_id))=1);
  execute 'reset role';
  if exists(select 1 from chart_checks where not passed) then
    raise exception 'Group chart authorization checks failed.';
  end if;
end;
$$;
select check_name, passed from chart_checks order by check_name;
rollback;

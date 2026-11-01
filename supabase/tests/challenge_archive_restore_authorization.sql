-- Disposable local database only.
\set ON_ERROR_STOP on
insert into public.profiles(id,display_name) values ('00000000-0000-4000-8000-000000000001','Archive owner');
insert into public.challenges(id,owner_id,created_by,name,start_date,end_date,status)
values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Archive fixture',current_date,current_date+30,'draft');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
create temp table archive_token as select token from public.create_challenge_invite('10000000-0000-4000-8000-000000000001',now()+interval '1 day');
grant select on archive_token to authenticated;
select public.archive_group_challenge('10000000-0000-4000-8000-000000000001');
do $$ begin
 if not exists(select 1 from public.challenges where status='archived' and archived_from_status='active') then raise exception 'archive provenance lost'; end if;
 begin
 perform public.create_challenge_invite('10000000-0000-4000-8000-000000000001',now()+interval '1 day');
 raise exception 'archived invite allowed';
 exception when insufficient_privilege then null; end;
 begin
 perform public.archive_group_challenge('10000000-0000-4000-8000-000000000001');
 raise exception 'double archive allowed';
 exception when invalid_parameter_value then null; end;
end $$;
select public.restore_group_challenge('10000000-0000-4000-8000-000000000001');
do $$ begin
 if not exists(select 1 from public.challenges where status='active' and archived_from_status is null) then raise exception 'active restore incorrect'; end if;
 if exists(select 1 from public.preview_challenge_invite((select token from archive_token)) where status <> 'revoked') then raise exception 'token revived'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 begin perform public.archive_group_challenge('10000000-0000-4000-8000-000000000001'); raise exception 'nonowner archived'; exception when insufficient_privilege then null; end;
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000001'); raise exception 'nonowner restored'; exception when insufficient_privilege then null; end;
end $$;
set role anon;
do $$ begin
 begin perform public.archive_group_challenge('10000000-0000-4000-8000-000000000001'); raise exception 'anon archived'; exception when insufficient_privilege then null; end;
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000001'); raise exception 'anon restored'; exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo PASS archive restore authorization

-- Fixtures and helper are local-only; checks run under actual API roles.
create schema archive_test;
create function archive_test.denied(command text) returns void language plpgsql as $$
begin
 begin
  execute command;
 exception when insufficient_privilege then return;
 end;
 raise exception 'Expected permission denial: %',command;
end $$;
grant usage on schema archive_test to authenticated;
grant execute on function archive_test.denied(text) to authenticated;
insert into public.participants(id,challenge_id,user_id,display_name,status,starting_weight_kg,target_weight_kg,joined_at)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Owner','active',90,80,now()-interval '2 days');
insert into public.weigh_ins(participant_id,recorded_date,weight_kg) values ('20000000-0000-4000-8000-000000000001',current_date,89);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
set role authenticated;
select * from public.save_personal_weigh_in(null,current_date,89,'Original',array['10000000-0000-4000-8000-000000000001']::uuid[]);
select public.archive_group_challenge('10000000-0000-4000-8000-000000000001');
-- Another authenticated account cannot restore an archived owner's group.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select archive_test.denied($q$select public.restore_group_challenge('10000000-0000-4000-8000-000000000001')$q$);
select archive_test.denied($q$select public.archive_group_challenge('10000000-0000-4000-8000-000000000001')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
-- RPC mutation denial.
select archive_test.denied($q$select public.change_my_group_target('10000000-0000-4000-8000-000000000001',79)$q$);
select archive_test.denied($q$select public.correct_my_enrollment_starting_weight('10000000-0000-4000-8000-000000000001',91)$q$);
select archive_test.denied($q$select public.save_personal_weigh_in(null,current_date-1,88,null,array['10000000-0000-4000-8000-000000000001']::uuid[])$q$);
select archive_test.denied($q$insert into public.participants(challenge_id,user_id,display_name,status,starting_weight_kg,target_weight_kg) values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','New','active',90,80)$q$);
select archive_test.denied($q$insert into public.weigh_ins(participant_id,recorded_date,weight_kg) values ('20000000-0000-4000-8000-000000000001',current_date-1,88)$q$);
select archive_test.denied($q$delete from public.challenges where id='10000000-0000-4000-8000-000000000001'$q$);
do $$ declare affected integer; begin
 update public.challenges set name='Forbidden'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'archived metadata updated'; end if;
 update public.participants set target_weight_kg=79; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'archived participant updated'; end if;
 delete from public.participants; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'archived participant deleted'; end if;
 update public.weigh_ins set weight_kg=88; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'archived group weigh-in updated'; end if;
 delete from public.weigh_ins; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'archived group weigh-in deleted'; end if;
 if (select count(*) from public.challenges)<>1 or (select count(*) from public.participants)<>1 then raise exception 'archived reads lost'; end if;
 if (select count(*) from public.get_group_weigh_in_history('10000000-0000-4000-8000-000000000001'))=0 then raise exception 'shared history lost'; end if;
end $$;
-- Personal edits preserve archived share links even when omitted by the form.
select * from public.save_personal_weigh_in((select id from public.personal_weigh_ins where recorded_date=current_date),current_date,87,'Edited',array[]::uuid[]);
do $$ begin
 if not exists(select 1 from public.get_group_weigh_in_history('10000000-0000-4000-8000-000000000001') where weight_kg=87) then raise exception 'personal edit or archived share lost'; end if;
end $$;
select public.delete_personal_weigh_in((select id from public.personal_weigh_ins where recorded_date=current_date));
do $$ begin if exists(select 1 from public.personal_weigh_ins) then raise exception 'personal delete blocked'; end if; end $$;
reset role;
-- Trigger enforcement also protects direct writes outside RLS.
do $$ begin
 begin update public.participants set target_weight_kg=79; raise exception 'trigger allowed archived mutation'; exception when insufficient_privilege then null; end;
 begin update public.weigh_ins set weight_kg=88; raise exception 'trigger allowed archived weigh-in mutation'; exception when insufficient_privilege then null; end;
end $$;
set role authenticated;
-- Recorded prior state cannot be overridden.
do $$ begin
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000001','completed'); raise exception 'wrong restore allowed'; exception when check_violation then null; end;
end $$;
select public.restore_group_challenge('10000000-0000-4000-8000-000000000001');
reset role;
-- Exercise Active and Completed source states, then end-date expiry.
do $$ declare source text; restored text; begin
 foreach source in array array['active','completed'] loop
  update public.challenges set status=source;
  perform public.archive_group_challenge('10000000-0000-4000-8000-000000000001');
  select status into restored from public.restore_group_challenge('10000000-0000-4000-8000-000000000001');
  if restored<>source then raise exception 'prior state lost: %',source; end if;
 end loop;
 update public.challenges set status='active',start_date=current_date-10,end_date=current_date-1;
 perform public.archive_group_challenge('10000000-0000-4000-8000-000000000001');
 select status into restored from public.restore_group_challenge('10000000-0000-4000-8000-000000000001');
 if restored<>'completed' then raise exception 'expired restore not completed'; end if;
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000001'); raise exception 'nonarchived restore allowed'; exception when insufficient_privilege then null; end;
end $$;
\echo PASS archived mutations, reads, personal edits/deletion and lifecycle transitions

-- Token acceptance must fail after restore, not merely report a revoked preview.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
set role authenticated;
do $$ begin
 begin
 perform public.accept_challenge_invite((select token from archive_token),'Former invite',90,80);
 raise exception 'old token accepted after restore';
 exception when sqlstate 'P0002' then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
-- Legacy archive has no source status and must require a valid explicit choice.
insert into public.challenges(id,owner_id,created_by,name,start_date,end_date,status)
values ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Legacy archive',current_date,current_date+30,'archived');
set role authenticated;
do $$ begin
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000002'); raise exception 'missing legacy choice accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.restore_group_challenge('10000000-0000-4000-8000-000000000002','archived'); raise exception 'invalid legacy choice accepted'; exception when invalid_parameter_value then null; end;
 perform public.restore_group_challenge('10000000-0000-4000-8000-000000000002','active');
 if not exists(select 1 from public.challenges where id='10000000-0000-4000-8000-000000000002' and status='active') then raise exception 'legacy explicit restore failed'; end if;
end $$;
reset role;
\echo PASS revoked token acceptance and legacy restore validation

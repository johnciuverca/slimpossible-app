-- LOCAL DISPOSABLE ONLY: runner-provisioned synthetic data, no remote execution.
\set ON_ERROR_STOP on
insert into public.profiles(id, display_name) values ('00000000-0000-4000-8000-000000000099', '[upgrade] fixture');
insert into public.challenges(id, owner_id, created_by, name, start_date, end_date, challenge_kind)
values ('10000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000099', '[upgrade] draft', current_date-400, current_date+30, null);
insert into public.personal_weigh_ins(id, user_id, recorded_date, weight_kg, note)
values ('20000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000099', current_date-365, 70, '[upgrade] retained private note');
insert into public.personal_weigh_in_group_shares(personal_weigh_in_id, challenge_id)
values ('20000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000099');
create temp table upgrade_rows_before as
  select 'personal' as source, to_jsonb(p) as row_data from public.personal_weigh_ins p
  union all select 'shares', to_jsonb(s) from public.personal_weigh_in_group_shares s
  union all select 'map', to_jsonb(m) from public.personal_weigh_in_legacy_map m
  union all select 'legacy', to_jsonb(w) from public.weigh_ins w
  union all select 'challenge', to_jsonb(c) from public.challenges c;
create temp table upgrade_acl_before as
  select proacl, proowner from pg_proc where oid='public.save_personal_weigh_in(uuid,date,numeric,text,uuid[])'::regprocedure;
-- Demonstrate the prior RPC rejected a setup-created draft group.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
do $$ begin
  begin
    perform * from public.save_personal_weigh_in('20000000-0000-4000-8000-000000000099', current_date-365, 69, null, array['10000000-0000-4000-8000-000000000099'::uuid]);
    raise exception 'Expected original active-only compatibility defect';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\ir ../migrations/20261008000000_allow_draft_group_weigh_in_sharing.sql
create temp table upgrade_rows_after as
  select 'personal' as source, to_jsonb(p) as row_data from public.personal_weigh_ins p
  union all select 'shares', to_jsonb(s) from public.personal_weigh_in_group_shares s
  union all select 'map', to_jsonb(m) from public.personal_weigh_in_legacy_map m
  union all select 'legacy', to_jsonb(w) from public.weigh_ins w
  union all select 'challenge', to_jsonb(c) from public.challenges c;
do $$ begin
  if exists(select * from upgrade_rows_before except select * from upgrade_rows_after)
     or exists(select * from upgrade_rows_after except select * from upgrade_rows_before) then
    raise exception 'RPC-only upgrade changed stored rows';
  end if;
  if exists(select proacl, proowner from upgrade_acl_before except select proacl, proowner from pg_proc where oid='public.save_personal_weigh_in(uuid,date,numeric,text,uuid[])'::regprocedure) then
    raise exception 'RPC-only upgrade changed ACL or ownership';
  end if;
end $$;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000099', true);
do $$ declare saved record; begin
  select * into saved from public.save_personal_weigh_in('20000000-0000-4000-8000-000000000099', current_date-365, 69, '[upgrade] correction', array['10000000-0000-4000-8000-000000000099'::uuid]);
  if saved.weight_kg <> 69 or saved.shared_challenge_ids <> array['10000000-0000-4000-8000-000000000099'::uuid] then
    raise exception 'Draft upgrade correction did not preserve sharing';
  end if;
end $$;
rollback;
select 'PASS upgrade preserves rows and RPC ACL; draft correction now succeeds without status changes' as result;

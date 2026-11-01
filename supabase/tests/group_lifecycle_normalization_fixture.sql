-- Run after archive migration, before lifecycle normalization, local DB only.
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000004');
insert into public.profiles(id,display_name) values ('00000000-0000-4000-8000-000000000004','Normalization owner');
insert into public.challenges(id,owner_id,created_by,name,start_date,end_date,status,challenge_kind)
select ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004',label,
current_date-20,current_date+20,state,kind
from (values (1,'Group draft','draft','group'),(2,'Group archived','archived','group'),(3,'Group completed','completed','group'),(4,'Personal draft','draft','personal'),(5,'Group active','active','group'),(6,'Legacy untyped group','draft',null)) f(n,label,state,kind);
-- Preserve actual historical provenance by archiving a draft before normalization.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.archive_group_challenge('90000000-0000-4000-8000-000000000005');
-- Fixture represents an existing historical archive with Draft provenance.
alter table public.challenges disable trigger challenges_guard_archive_state;
update public.challenges set archived_from_status='draft' where id='90000000-0000-4000-8000-000000000005';
alter table public.challenges enable trigger challenges_guard_archive_state;
create table normalization_before as select id,to_jsonb(c) as original from public.challenges c where owner_id='00000000-0000-4000-8000-000000000004';

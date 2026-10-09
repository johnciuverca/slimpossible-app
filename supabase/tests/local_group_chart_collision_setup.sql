-- LOCAL ONLY: synthetic populated accounts, including every formerly fixed date.
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'Existing synthetic owner'),
  ('00000000-0000-4000-8000-000000000002', 'Existing synthetic member');
insert into public.challenges (id,owner_id,created_by,name,start_date,end_date,status,challenge_kind)
values ('00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Existing synthetic group',current_date-30,current_date+30,'active','group');
insert into public.personal_weigh_ins (user_id,recorded_date,weight_kg,note)
select account.id, current_date+day_offset, 75, 'Existing synthetic note: must stay unchanged'
from (values ('00000000-0000-4000-8000-000000000001'::uuid),
  ('00000000-0000-4000-8000-000000000002'::uuid)) account(id)
cross join generate_series(-14, 2) day_offset;
insert into public.personal_weigh_in_group_shares (personal_weigh_in_id,challenge_id)
select id,'00000000-0000-4000-8000-000000000100'::uuid
from public.personal_weigh_ins;
